{
  inputs = {
    nixpkgs.url = "github:cachix/devenv-nixpkgs/rolling";
    flake-utils.url = "github:numtide/flake-utils";
    agent-skills.url = "github:Kyure-A/agent-skills-nix";
    nur-packages.url = "github:Hol1kgmg/nur-packages";
    agent-rules.url = "github:Hol1kgmg/agent-rules-nix";
    agent-rules.inputs.nixpkgs.follows = "nixpkgs";
    agent-rules.inputs.agent-skills.follows = "agent-skills";
  };

  outputs = { nixpkgs, flake-utils, agent-skills, nur-packages, agent-rules, ... }:
    let
      agentLib = agent-skills.lib.agent-skills;
      rulesLib = agent-rules.lib.agent-rules;

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

      # ルールの取得元は ./registry/rules、有効にする ID は ./rules.nix（skills と対称）
      ruleSources = rulesLib.sourcesFromLock {
        manifestsDir = ./registry/rules;
        lockFile = ./registry/rules.lock.json;
      } // {
        local = { path = ./rules; };
      };
      ruleCatalog = rulesLib.discoverCatalog ruleSources;
      ruleSelection = rulesLib.selectRules {
        catalog = ruleCatalog;
        allowlist = import ./rules.nix;
      };
      ruleTargets = {
        agents = rulesLib.defaultLocalTargets.claude // { dest = ".agents/rules"; enable = true; };
      };
    in
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        # CI の setup-node にも同じバージョンを渡すため、ここを唯一の定義箇所にする
        nodejs = pkgs.nodejs_24;
        bundle = agentLib.mkBundle { inherit pkgs selection; };
        rulesBundle = rulesLib.mkBundle { inherit pkgs; selection = ruleSelection; };
        listApp = name: ids: {
          type = "app";
          program = "${pkgs.writeShellScriptBin name ''
            cat ${pkgs.writeText "${name}-ids" (nixpkgs.lib.concatLines ids)}
          ''}/bin/${name}";
        };
      in {
        # skills.nix / rules.nix の宣言が解決できてバンドルが組めるかの確認（nix flake check）
        checks.skills = bundle;
        checks.rules = rulesBundle;

        apps.rules-list = listApp "rules-list" (builtins.attrNames ruleCatalog);

        # registry/rules/*.nix を解決して rules.lock.json を更新する
        apps.rules-sources-lock = {
          type = "app";
          program = "${rulesLib.mkSourceLockProgram { inherit pkgs; }}/bin/rules-sources-lock";
        };

        apps.rules-install-local = {
          type = "app";
          program = "${rulesLib.mkLocalInstallProgram { inherit pkgs; bundle = rulesBundle; targets = ruleTargets; }}/bin/rules-install-local";
        };

        # sources から見つかった全スキル ID の一覧（skills.nix の候補）
        apps.skills-list = listApp "skills-list" (builtins.attrNames catalog);

        # registry/sources/*.nix を解決して sources.lock.json を更新する
        apps.skills-sources-lock = {
          type = "app";
          program = "${agentLib.mkSourceLockProgram { inherit pkgs; }}/bin/skills-sources-lock";
        };

        apps.skills-install-local = {
          type = "app";
          program = "${agentLib.mkLocalInstallProgram { inherit pkgs bundle; targets = localTargets; }}/bin/skills-install-local";
        };

        # GitHub Actions が `nix eval --raw .#node.version` で参照する。
        # flake.lock の nixpkgs 更新に CI の Node.js バージョンを自動追従させるため。
        packages.node = nodejs;

        # backend-ci 用。default は gcloud や skills まで含み CI の環境構築だけで約 2 分かかるため最小構成に絞る
        devShells.backend = pkgs.mkShell {
          packages = [ pkgs.just pkgs.go pkgs.sqlc pkgs.oapi-codegen ];
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
            pkgs.google-cloud-sdk
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
          } + rulesLib.mkShellHook {
            inherit pkgs;
            bundle = rulesBundle;
            targets = ruleTargets;
            quiet = true;
          };
        };
      });
}
