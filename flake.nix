{
  inputs = {
    nixpkgs.url = "github:cachix/devenv-nixpkgs/rolling";
    flake-utils.url = "github:numtide/flake-utils";
    agent-skills.url = "github:Kyure-A/agent-skills-nix";
    nur-packages.url = "github:Hol1kgmg/nur-packages";
  };

  outputs = { nixpkgs, flake-utils, agent-skills, nur-packages, ... }:
    let
      agentLib = agent-skills.lib.agent-skills;

      # スキルの取得元は ./registry/sources、有効にする ID は ./skills.nix
      sources = agentLib.sourcesFromLock {
        manifestsDir = ./registry/sources;
        lockFile = ./registry/sources.lock.json;
      } // {
        # 独自スキル。rev 固定が不要なため lock には載せない。
        local = { path = ./skills; };
      };
      catalog = agentLib.discoverCatalog sources;
      selection = agentLib.selectSkills {
        inherit catalog sources;
        # ./skills 配下は宣言不要で全件有効
        allowlist = import ./skills.nix
          ++ agentLib.allowlistFor { inherit catalog sources; enableAll = [ "local" ]; };
      };

      localTargets = {
        agents = agentLib.defaultLocalTargets.agents // { enable = true; };
      };
    in
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        bundle = agentLib.mkBundle { inherit pkgs selection; };

        # CI の setup-node にも同じバージョンを渡すため、ここを唯一の定義箇所にする
        nodejs = pkgs.nodejs_24;
      in {
        # GitHub Actions が `nix eval --raw .#node.version` で参照する。
        # flake.lock の nixpkgs 更新に CI の Node.js バージョンを自動追従させるため。
        packages.node = nodejs;

        # skills.nix の宣言が解決できてバンドルが組めるかの確認（nix flake check）
        checks.skills = bundle;

        # sources から見つかった全スキル ID の一覧（skills.nix の候補）
        apps.skills-list = {
          type = "app";
          program = "${pkgs.writeShellScriptBin "skills-list" ''
            cat ${pkgs.writeText "skill-ids" (nixpkgs.lib.concatLines (builtins.attrNames catalog))}
          ''}/bin/skills-list";
        };

        # registry/sources/*.nix を解決して sources.lock.json を更新する
        apps.skills-sources-lock = {
          type = "app";
          program = "${agentLib.mkSourceLockProgram { inherit pkgs; }}/bin/skills-sources-lock";
        };

        apps.skills-install-local = {
          type = "app";
          program = "${agentLib.mkLocalInstallProgram { inherit pkgs bundle; targets = localTargets; }}/bin/skills-install-local";
        };

        devShells.default = pkgs.mkShell {
          packages = [
            nodejs
            pkgs.just
            pkgs.gitleaks
            pkgs.lefthook
            pkgs.gh
            pkgs.gh-dash
            nur-packages.packages.${system}.markserv
            nur-packages.packages.${system}.spec-kit
            # backend。golang-migrate は Nix 版 CLI が macOS で起動時に panic するため
            # compose の migrate/migrate イメージで実行する（just migrate）
            pkgs.go
            pkgs.gopls
            pkgs.sqlc
            pkgs.oapi-codegen
          ];

          shellHook = ''
            lefthook install >/dev/null

            # corepack (pnpm) の shim をプロジェクトローカルに隔離する
            corepack_dir="$PWD/.direnv/state/corepack-bin"
            mkdir -p "$corepack_dir"
            corepack enable --install-directory "$corepack_dir"
            export PATH="$corepack_dir:$PATH"
          '' + agentLib.mkShellHook {
            inherit pkgs bundle;
            targets = localTargets;
            quiet = true;
          };
        };
      });
}
