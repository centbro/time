<#
PowerShell script to create a GitHub repo and push the current folder.
Usage: .\push-to-github.ps1 -RepoName time -Visibility public

Behavior:
- If `gh` CLI is available, uses `gh repo create` to create the repo and push.
- Else if environment variable `GITHUB_TOKEN` is set, uses GitHub REST API to create the repo.
- Otherwise prints manual instructions.
#>

param(
  [string]$RepoName = "time",
  [ValidateSet('public','private')][string]$Visibility = 'public'
)

function Write-Note($msg){ Write-Host "[info] $msg" -ForegroundColor Cyan }
function Write-Err($msg){ Write-Host "[error] $msg" -ForegroundColor Red }

Set-Location -Path (Split-Path -Path $MyInvocation.MyCommand.Definition -Parent) | Out-Null

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Err 'Git이 설치되어 있지 않습니다. 먼저 Git을 설치하세요: https://git-scm.com/downloads'
  exit 1
}

if (-not (Test-Path .git)){
  Write-Note '로컬 저장소 초기화 중...'
  git init
  git add -A
  git commit -m "Initial commit"
} else {
  Write-Note '이미 git 저장소가 감지되었습니다.'
}

if (Get-Command gh -ErrorAction SilentlyContinue){
  Write-Note 'gh CLI가 감지되었습니다. GitHub에 리포지토리를 생성합니다...'
  $vis = if ($Visibility -eq 'public') { '--public' } else { '--private' }
  try{
    gh repo create $RepoName $vis --source=. --remote=origin --push --confirm
    Write-Note "리포지토리 생성 및 푸시 완료: $RepoName"
    exit 0
  } catch {
    Write-Err "gh로 리포지토리 생성에 실패했습니다: $_"
  }
}

# gh가 없으면 GITHUB_TOKEN으로 API 시도
if ($env:GITHUB_TOKEN){
  Write-Note 'GITHUB_TOKEN이 존재합니다. REST API로 리포지토리를 생성합니다.'
  $body = @{ name = $RepoName; private = ($Visibility -ne 'public') } | ConvertTo-Json
  try{
    $resp = Invoke-RestMethod -Uri 'https://api.github.com/user/repos' -Method Post -Headers @{ Authorization = "token $env:GITHUB_TOKEN"; 'User-Agent'='push-to-github-script' } -Body $body -ContentType 'application/json'
    Write-Note "리포지토리 생성됨: $($resp.html_url)"
    if (-not (git remote)) { git remote add origin $resp.clone_url }
    git branch -M main
    git push -u origin main
    Write-Note '푸시 완료.'
    exit 0
  } catch {
    Write-Err "REST API로 리포지토리 생성 중 오류 발생: $_"
  }
}

Write-Note '자동 생성이 불가능합니다. 수동으로 리포지토리를 생성하고 원격을 추가하십시오.'
Write-Host "1) GitHub에서 새 리포지토리 '$RepoName'를 생성 (public=$Visibility)"
Write-Host "2) 로컬에서 아래 명령 실행:"
Write-Host "   git remote add origin https://github.com/<your-username>/$RepoName.git"
Write-Host "   git branch -M main"
Write-Host "   git push -u origin main"
