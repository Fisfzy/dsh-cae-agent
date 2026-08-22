# dsh-cae-agent 构建期依赖链接
# 目标：把「已安装的 dsh 发行包」里 bundled 的 @deepseek-ai/{cordis,dsh-tools,schemastery}
#       与 @types/node 以 Junction 方式挂进本包 node_modules，使 TS 类型与运行时都能解析
#       （三者皆 restricted / 私有，外网不能加）。
# 来源：npm 全局安装的 @deepseek-ai/dsh\node_modules\@deepseek-ai\{cordis,dsh-tools,schemastery}
param(
  [string]$DshRoot = (Join-Path $env:APPDATA 'npm\node_modules\@deepseek-ai\dsh')
)

$ErrorActionPreference = 'Stop'
$NodeModules = Join-Path $PSScriptRoot '..\node_modules'
New-Item -ItemType Directory -Force -Path (Join-Path $NodeModules '@deepseek-ai') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $NodeModules '@types') | Out-Null

function Link([string]$Rel, [string]$Abs) {
  $target = Join-Path $NodeModules $Rel
  if (-not (Test-Path (Join-Path (Split-Path $target) (Split-Path $Rel -Leaf)))) {
    New-Item -ItemType Junction -Path $target -Target $Abs | Out-Null
    Write-Host "linked $Rel -> $Abs"
  } else {
    Write-Host "exists $Rel"
  }
}

foreach ($mod in @('cordis', 'dsh-tools', 'schemastery', 'dsh-attachment')) {
  $abs = Join-Path $DshRoot "node_modules\@deepseek-ai\$mod"
  if (-not (Test-Path $abs)) {
    Write-Error "not found in dsh bundle: $abs (try -DshRoot <dsh install root>)"
  }
  Link "@deepseek-ai\$mod" $abs
}

# @types/node：优先从本包已装 devDep 解析；其次从 dsh 发行包借用
$at = Join-Path $NodeModules '@types\node'
if (-not (Test-Path $at)) {
  $src = Join-Path $DshRoot 'node_modules\@types\node'
  if (Test-Path $src) { Link '@types\node' $src }
}

# @deepseek-ai/schemastery 依赖 @standard-schema/spec 类型（peers 已由 dsh 闭包注入，构建型检查用 skipLibCheck 容忍）。
Write-Host "link-deps: done"
