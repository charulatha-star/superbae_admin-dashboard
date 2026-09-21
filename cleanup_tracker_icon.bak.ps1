$ErrorActionPreference = 'Stop'
$root = 'c:/Users/HP/Desktop/Superbae'
$utf8 = New-Object System.Text.UTF8Encoding($false)

function EditFile([string]$rel, [array]$rules) {
  $path = Join-Path $root $rel
  $text = [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)
  foreach ($r in $rules) {
    $pattern = $r[0]; $label = $r[1]; $expect = [int]$r[2]; $repl = $r[3]
    $m = [regex]::Matches($text, $pattern)
    if ($expect -ge 0 -and $m.Count -ne $expect) {
      throw "FAIL $rel :: $label :: expected $expect match(es), found $($m.Count)"
    }
    if ($expect -lt 0 -and $m.Count -eq 0) {
      throw "FAIL $rel :: $label :: expected at least 1 match, found 0"
    }
    $text = [regex]::Replace($text, $pattern, $repl)
    Write-Host ("OK   {0} :: {1} :: {2} match(es)" -f $rel, $label, $m.Count)
  }
  [IO.File]::WriteAllText($path, $text, $utf8)
  Write-Host ("SAVED {0}" -f $rel)
}

# ---------------- backend service ----------------
EditFile 'admin-dashboard-backend/src/services/trackerConfig.ts' @(
  ,@('[ \t]*icon: optionalText\(input\.icon\),\r?\n', 'trackers-create icon field', 1, '')
  ,@('[ \t]*if \(input\.icon !== undefined\) updates\.icon = optionalText\(input\.icon\);\r?\n', 'trackers-update icon field', 1, '')
  ,@('function sharedOptionBase\(input: LooseDocument, includeIcon = true\): LooseDocument \{', 'sharedOptionBase signature', 1, 'function sharedOptionBase(input: LooseDocument): LooseDocument {')
  ,@('[ \t]*\.\.\.\(includeIcon \? \{ icon: optionalText\(input\.icon\) \} : \{\}\),\r?\n', 'includeIcon spread', 1, '')
  ,@("sharedOptionBase\(input, resource !== 'moodOptions'\)", 'sharedOptionBase caller', 1, 'sharedOptionBase(input)')
  ,@("[ \t]*if \(input\.icon !== undefined\) throw new TrackerInputError\('icon is not supported for moodOptions; use emoji\.'\);\r?\n", 'moodOptions icon throw (create+update)', 2, '')
  ,@("  if \(resource === 'moodOptions'\) \{(\r?\n)\s*return \{ \.\.\.base, emoji: optionalText\(input\.emoji\) \};(\r?\n)\s*\}", 'moodOptions create block to one-liner', 1, "  if (resource === 'moodOptions') return { ...base, emoji: optionalText(input.emoji) };")
  ,@("[ \t]*if \(resource === 'moodOptions'\) \{\r?\n[ \t]*\}\r?\n", 'empty moodOptions update block', 1, '')
)

# ---------------- backend registry (stale comment) ----------------
EditFile 'admin-dashboard-backend/src/models/registry.ts' @(
  ,@('// Mood Options: label \+ emoji[^\r\n]*\r?\n[ \t]*// \(emoji is the mood''s visual identity\)\.', 'moodOptions schema comment', 1, "// Mood Options: shared shape + emoji (the mood's visual identity).")
)

# ---------------- backend seed ----------------
EditFile 'admin-dashboard-backend/src/scripts/seedTrackers.ts' @(
  ,@("icon: (?:'[^']*'|null), ", 'seed icon properties', -1, '')
)

# ---------------- frontend config ----------------
EditFile 'admin-dashboard-frontend/src/app/admin/settings/trackers/trackerConfig.ts' @(
  ,@('[ \t]*icon: string \| null;\r?\n', 'TrackerDoc.icon type', 1, '')
  ,@('[ \t]*icon\?: string \| null;\r?\n', 'OptionRow.icon type', 1, '')
  ,@("[ \t]*\{ key: 'icon', label: 'Icon', kind: 'text', placeholder: 'Icon name \(optional\)' \},\r?\n", 'Icon form field defs', 2, '')
)

# ---------------- frontend OptionManager ----------------
EditFile 'admin-dashboard-frontend/src/app/admin/settings/trackers/components/OptionManager.tsx' @(
  ,@("[ \t]*if \(def\.key !== 'moodOptions'\) \{\r?\n[ \t]*payload\.icon = String\(values\.icon \?\? ''\)\.trim\(\) \|\| null;\r?\n[ \t]*\}\r?\n", 'payload.icon block', 1, '')
  ,@("[ \t]*\{!def\.reminder && \(\r?\n[ \t]*<OptionFieldInput\r?\n[ \t]*field=\{\{ key: 'isActive', label: 'Active', kind: 'boolean' \}\}\r?\n[ \t]*value=\{Boolean\(values\.isActive\)\}\r?\n[ \t]*onChange=\{\(v\) => setValues\(\(prev\) => \(\{ \.\.\.prev, isActive: Boolean\(v\) \}\)\)\}\r?\n[ \t]*/>\r?\n[ \t]*\)\}\r?\n", 'duplicate appended isActive field', 1, '')
)

# ---------------- frontend TrackersTable ----------------
EditFile 'admin-dashboard-frontend/src/app/admin/settings/trackers/components/TrackersTable.tsx' @(
  ,@("[ \t]*icon: doc\.icon \?\? '',\r?\n", 'form init icon value', 1, '')
  ,@("[ \t]*icon: String\(form\.values\.icon \?\? ''\)\.trim\(\) \|\| null,\r?\n", 'create/edit payload icon', 1, '')
)

Write-Host 'ALL EDITS APPLIED'
