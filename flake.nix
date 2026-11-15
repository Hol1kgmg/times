{
  inputs = {
    nixpkgs.url = "github:cachix/devenv-nixpkgs/rolling";
    # devenv-nixpkgs の apm-cli は websockets の版制約でビルドに失敗するため
    nixpkgs-unstable.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    nur-packages.url = "github:Hol1kgmg/nur-packages";
    nix-claude-code.url = "github:ryoppippi/nix-claude-code";
    nix-claude-code.inputs.nixpkgs.follows = "nixpkgs";

    # --- project inputs: 派生先が管理。adr/from-template/0005 ---

  };

  outputs = { self, nixpkgs, nixpkgs-unstable, flake-utils, nur-packages, nix-claude-code, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in {
        # テンプレート管理（派生先は devShells.default を編集）。adr/from-template/0005
        devShells.template = pkgs.mkShell {
          packages = [
            pkgs.just
            pkgs.jq
            pkgs.yq-go
            pkgs.gitleaks
            pkgs.lefthook
            pkgs.gh
            pkgs.git
            pkgs.dotenvx
            nur-packages.packages.${system}.markserv
            nur-packages.packages.${system}.portless
            # gh は上で別途入れているため同梱版 default ではなく minimal
            nix-claude-code.packages.${system}.claude-minimal
            pkgs.codex
            nixpkgs-unstable.legacyPackages.${system}.apm-cli
            # yomiyasu スキルのスクリプトが使う
            pkgs.python3
          ];

          shellHook = ''
            lefthook install >/dev/null
            # CI は -c で apm install --frozen を直接呼んで失敗を拾うため、ここでは二重に走らせない
            if [ -z "''${CI:-}" ] && ! out=$(apm install --frozen 2>&1); then
              printf '%s\n' "$out" >&2
              echo "apm install --frozen に失敗した。apm.yml を変えたなら just apm を実行する" >&2
            fi
          '';
        };

        # --- 派生先が管理。adr/from-template/0005 ---
        devShells.default = pkgs.mkShell {
          inputsFrom = [ self.devShells.${system}.template ];
          packages = [
            self.packages.${system}.node
            # just fe-font-subset の pyftsubset。woff2 の書き出しに brotli が要る
            (pkgs.python3.withPackages (ps: [ ps.fonttools ps.brotli ]))
            nur-packages.packages.${system}.spec-kit
            # backend。golang-migrate は Nix 版 CLI が macOS で起動時に panic するため
            # compose の migrate/migrate イメージで実行する（just migrate）
            pkgs.go
            pkgs.gopls
            pkgs.sqlc
            pkgs.oapi-codegen
            pkgs.tbls
            pkgs.redocly
            # pkgs.google-cloud-sdk # ビルドが重かったので、一旦コメントアウト
          ];

          shellHook = ''
            # corepack (pnpm) の shim をプロジェクトローカルに隔離する
            corepack_dir="$PWD/.direnv/state/corepack-bin"
            mkdir -p "$corepack_dir"
            corepack enable --install-directory "$corepack_dir"
            export PATH="$corepack_dir:$PATH"
          '';
        };

        # GitHub Actions が `nix eval --raw .#node.version` で参照する。
        # flake.lock の nixpkgs 更新に CI の Node.js バージョンを自動追従させるため。
        # CI の setup-node にも同じバージョンを渡すため、ここを唯一の定義箇所にする
        packages.node = pkgs.nodejs_26;

        # backend-ci 用。default は gcloud や skills まで含み CI の環境構築だけで約 2 分かかるため最小構成に絞る
        devShells.backend = pkgs.mkShell {
          packages = [ pkgs.just pkgs.go pkgs.sqlc pkgs.oapi-codegen pkgs.tbls ];
        };
      });
}
