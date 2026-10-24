param([ValidateSet('inspect','create','pages','status')][string]$Action = 'inspect')
$ErrorActionPreference = 'Stop'
$env:GIT_TERMINAL_PROMPT = '0'
$env:GCM_INTERACTIVE = 'Never'
# Credentials remain in process memory. Never write headers or credential output.
$taskCredentialLines = "protocol=https`nhost=github.com`n`n" | git credential fill 2>$null
if ($LASTEXITCODE -ne 0) { throw 'No noninteractive GitHub credential is available.' }
$taskCredential = @{}
foreach ($taskLine in $taskCredentialLines) { $taskPair = $taskLine -split '=',2; if ($taskPair.Length -eq 2) { $taskCredential[$taskPair[0]] = $taskPair[1] } }
if (!$taskCredential.ContainsKey('password')) { throw 'GitHub authentication is unavailable.' }
$taskHeaders = @{ Authorization = ('Bearer ' + $taskCredential['password']); Accept = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2022-11-28' }
function Request-GitHub([string]$Path, [string]$Method = 'GET', $Body = $null) {
  $taskParams = @{ Uri = ('https://api.github.com' + $Path); Headers = $taskHeaders; Method = $Method }
  if ($null -ne $Body) { $taskParams['Body'] = ($Body | ConvertTo-Json -Depth 10); $taskParams['ContentType'] = 'application/json; charset=utf-8' }
  Invoke-RestMethod @taskParams
}
$taskUser = Request-GitHub '/user'
if ($taskUser.login -ne 'cannoyroy') { throw 'Authenticated account differs from the verified release owner; stopped.' }
$taskRepoPath = '/repos/cannoyroy/paper-reconstruction'
if ($Action -eq 'inspect') {
  try { $taskRepo = Request-GitHub $taskRepoPath; [PSCustomObject]@{ Login=$taskUser.login; Exists=$true; Url=$taskRepo.html_url; Empty=($taskRepo.size -eq 0); Private=$taskRepo.private } }
  catch { if ($_.Exception.Response.StatusCode.value__ -eq 404) { [PSCustomObject]@{ Login=$taskUser.login; Exists=$false } } else { throw } }
}
if ($Action -eq 'create') {
  $taskExists = $false
  try { $null = Request-GitHub $taskRepoPath; $taskExists = $true } catch { if ($_.Exception.Response.StatusCode.value__ -ne 404) { throw } }
  if ($taskExists) { throw 'Repository already exists; this command never replaces an existing repository.' }
  $taskRepo = Request-GitHub '/user/repos' 'POST' @{ name='paper-reconstruction'; description='Evidence-grounded research decision reconstruction: Codex Skill, structured results and interactive reader'; private=$false; auto_init=$false; has_wiki=$false; homepage='https://cannoyroy.github.io/paper-reconstruction/' }
  [PSCustomObject]@{ Created=$true; Url=$taskRepo.html_url; CloneUrl=$taskRepo.clone_url }
}
if ($Action -eq 'pages') {
  try { $taskPages = Request-GitHub ($taskRepoPath + '/pages') }
  catch { if ($_.Exception.Response.StatusCode.value__ -ne 404) { throw }; $taskPages = Request-GitHub ($taskRepoPath + '/pages') 'POST' @{ build_type='workflow' } }
  [PSCustomObject]@{ Url=$taskPages.html_url; BuildType=$taskPages.build_type; Status=$taskPages.status }
}
if ($Action -eq 'status') {
  $taskRuns = Request-GitHub ($taskRepoPath + '/actions/runs?per_page=5')
  $taskRuns.workflow_runs | Select-Object id,name,status,conclusion,html_url,head_sha
}
