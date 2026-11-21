#!/usr/bin/env bash
set -euo pipefail

conflicted=$(git diff --name-only --diff-filter=U)
if [ -z "$conflicted" ]; then
    echo "衝突ではない理由でマージが失敗した。上の git merge の出力を確認する" >&2
    exit 1
fi
others=$(grep -vxE 'flake\.lock|apm\.lock\.yaml|\.github/workflows/actions\.lock' <<<"$conflicted" || true)
if [ -n "$others" ]; then
    printf 'lock 以外も衝突しているため手で解消する:\n%s\n' "$others" >&2
    exit 1
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# 派生側でテンプレートを取り込むため、ours が派生側、theirs がテンプレート側になる
stages() {
    local f=$1
    if ! git cat-file -e ":2:$f" 2>/dev/null || ! git cat-file -e ":3:$f" 2>/dev/null; then
        echo "$f が片側で削除されているため手で解消する" >&2
        exit 1
    fi
    git show ":1:$f" > "$tmp/base" 2>/dev/null || echo '{}' > "$tmp/base"
    git show ":2:$f" > "$tmp/ours"
    git show ":3:$f" > "$tmp/theirs"
}

resolve_flake_lock() {
    stages flake.lock
    # 作り直すと project inputs が最新版になり Dependabot PR と重複するため、書き戻せないものは止める
    jq -S -n --slurpfile b "$tmp/base" --slurpfile o "$tmp/ours" --slurpfile t "$tmp/theirs" '
      $b[0] as $b | $o[0] as $o | $t[0] as $t
      | [$o.nodes.root.inputs | to_entries[]
         | select($t.nodes.root.inputs[.key] == null and ($b.nodes.root.inputs // {})[.key] == null)]
      | reduce .[] as $p ($t;
          if ($p.value | type) != "string" then error("follows の project input は書き戻せない: \($p.key)")
          elif $o.nodes[$p.value].flake != false or ($o.nodes[$p.value] | has("inputs")) then error("flake = false でない project input は書き戻せない: \($p.key)")
          elif .nodes[$p.value] != null then error("node 名がテンプレート側と重複: \($p.value)")
          else .nodes[$p.value] = $o.nodes[$p.value] | .nodes.root.inputs[$p.key] = $p.value
          end)
    ' > "$tmp/flake.lock"
    mv "$tmp/flake.lock" flake.lock
    git add flake.lock
}

resolve_apm_lock() {
    stages apm.lock.yaml
    for s in base ours theirs; do yq -p yaml -o json "$tmp/$s" > "$tmp/$s.json"; done
    jq -n --slurpfile b "$tmp/base.json" --slurpfile o "$tmp/ours.json" --slurpfile t "$tmp/theirs.json" '
      def key: "\(.repo_url)#\(.virtual_path // "")";
      def project(f; k): [($b[0] | f)[], ($t[0] | f)[] | k] as $known
        | [($o[0] | f)[] | select(k as $k | $known | index($k) | not)];
      $t[0]
      # resolved_commit を書き戻さないと、apm install が派生側の依存を最新版に進める
      | .dependencies += project(.dependencies // []; key)
      # 書き戻さないと、派生側の依存が置いたファイルを apm が管理外とみなして上書きしない
      | .deployments = (.deployments // []) + project(.deployments // []; .value)
    ' | yq -p json -o yaml > apm.lock.yaml
    git add apm.lock.yaml
}

resolve_actions_lock() {
    local f=.github/workflows/actions.lock
    stages "$f"
    for s in base ours theirs; do yq -p yaml -o json "$tmp/$s" > "$tmp/$s.json"; done
    # base はテンプレートの前回の版なので、ours から base を引いた残りが派生側の追加になる
    jq -n --slurpfile b "$tmp/base.json" --slurpfile o "$tmp/ours.json" --slurpfile t "$tmp/theirs.json" '
      $b[0] as $b | $o[0] as $o | $t[0] as $t
      | $t
      | .workflows = reduce ($o.workflows | to_entries[]) as $w (.workflows;
          .[$w.key] = ((.[$w.key] // []) + ($w.value - (($b.workflows // {})[$w.key] // [])) | unique))
      | .dependencies += ($o.dependencies | with_entries(select(
          $t.dependencies[.key] == null and ($b.dependencies // {})[.key] == null)))
    ' | yq -p json -o yaml -I4 > "$f"
    git add "$f"
}

if grep -qx flake.lock <<<"$conflicted"; then resolve_flake_lock; fi
if grep -qx apm.lock.yaml <<<"$conflicted"; then resolve_apm_lock; fi
if grep -qx .github/workflows/actions.lock <<<"$conflicted"; then resolve_actions_lock; fi
