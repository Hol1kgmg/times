{
  inputs = {
    nixpkgs.url = "github:cachix/devenv-nixpkgs/rolling";
    flake-utils.url = "github:numtide/flake-utils";
    agent-skills.url = "github:Kyure-A/agent-skills-nix";
    nur-packages.url = "github:Hol1kgmg/nur-packages";
    agent-rules.url = "github:Hol1kgmg/agent-rules-nix";
    agent-rules.inputs.nixpkgs.follows = "nixpkgs";
    agent-rules.inputs.agent-skills.follows = "agent-skills";
    nix-claude-code.url = "github:ryoppippi/nix-claude-code";
    nix-claude-code.inputs.nixpkgs.follows = "nixpkgs";

    # skill / rules の取得元。flake input にしておくと Dependabot (nix ecosystem) が
    # input ごとに更新 PR を出し、dependabot-review でレビューできる
    anthropic-skills = { url = "github:anthropics/skills"; flake = false; };
    vercel-ai = { url = "github:vercel/ai"; flake = false; };
    web-quality-skills = { url = "github:addyosmani/web-quality-skills"; flake = false; };
    yomiyasu = { url = "github:nanaism/yomiyasu"; flake = false; };
    hol1kgmg-skills = { url = "github:Hol1kgmg/skills"; flake = false; };
    security-audit-skill = { url = "github:cloudflare/security-audit-skill"; flake = false; };
    cognitive-rhythm-writing = { url = "git+https://gist.github.com/k16shikano/eb2929f13ed19c97188393d297be8432.git"; flake = false; };
    japanese-tech-writing = { url = "git+https://gist.github.com/k16shikano/fd287c3133457c4fd8f5601d34aa817d.git"; flake = false; };
    hol1kgmg-rules = { url = "github:Hol1kgmg/rules"; flake = false; };
    feature-sliced-skills = { url = "github:feature-sliced/skills"; flake = false; };
    google-skills = { url = "github:google/skills"; flake = false; };
  };

  outputs = inputs@{ nixpkgs, flake-utils, agent-skills, nur-packages, agent-rules, nix-claude-code, ... }:
    let
      agentLib = agent-skills.lib.agent-skills;
      rulesLib = agent-rules.lib.agent-rules;

      # 有効にする ID は ./skills.nix
      sources = {
        anthropic = { path = inputs.anthropic-skills.outPath; subdir = "skills"; };
        vercel = { path = inputs.vercel-ai.outPath; subdir = "skills"; };
        web-quality = { path = inputs.web-quality-skills.outPath; subdir = "skills"; };
        yomiyasu = { path = inputs.yomiyasu.outPath; subdir = "skills"; };
        hol1kgmg = { path = inputs.hol1kgmg-skills.outPath; subdir = "skills"; };
        security-audit = { path = inputs.security-audit-skill.outPath; subdir = "skills"; };
        # gist はルート直下に SKILL.md があり、ファイル名がそのままスキル ID になる
        cognitive-rhythm-writing = { path = inputs.cognitive-rhythm-writing.outPath; filter.maxDepth = 0; };
        japanese-tech-writing = { path = inputs.japanese-tech-writing.outPath; filter.maxDepth = 0; };
        local = { path = ./skills; };
        # このリポジトリ固有（template 由来の行より下に置き、sync の衝突を避ける）
        feature-sliced = { path = inputs.feature-sliced-skills.outPath; };
        google = { path = inputs.google-skills.outPath; subdir = "skills/cloud"; };
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

      # 有効にする ID は ./rules.nix（skills と対称）
      ruleSources = {
        hol1kgmg = { path = inputs.hol1kgmg-rules.outPath; subdir = "rules"; };
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

        apps.rules-install-local = {
          type = "app";
          program = "${rulesLib.mkLocalInstallProgram { inherit pkgs; bundle = rulesBundle; targets = ruleTargets; }}/bin/rules-install-local";
        };

        # sources から見つかった全スキル ID の一覧（skills.nix の候補）
        apps.skills-list = listApp "skills-list" (builtins.attrNames catalog);

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
            # just fe-font-subset の pyftsubset。woff2 の書き出しに brotli が要る
            (pkgs.python3.withPackages (ps: [ ps.fonttools ps.brotli ]))
            nur-packages.packages.${system}.markserv
            nur-packages.packages.${system}.spec-kit
            # gh は上で別途入れているため同梱版 default ではなく minimal
            nix-claude-code.packages.${system}.claude-minimal
            pkgs.codex
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
