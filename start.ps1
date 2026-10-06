$ErrorActionPreference = "Stop"

function Invoke-Checked {
    param([string]$Command, [string[]]$Arguments)
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Falló $Command. Revisa el mensaje anterior y docs/guia-companero.md."
    }
}

Push-Location $PSScriptRoot
$PreviousDemoMode = $env:DEMO_MODE
try {
    if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
        throw "Instala uv siguiendo docs/guia-companero.md y vuelve a abrir PowerShell."
    }
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        throw "Instala Node.js LTS siguiendo docs/guia-companero.md y vuelve a abrir PowerShell."
    }
    Invoke-Checked "uv" @("sync", "--locked")
    Invoke-Checked "npm.cmd" @("--prefix", "frontend", "ci")
    Invoke-Checked "npm.cmd" @("--prefix", "frontend", "run", "build")
    Invoke-Checked "uv" @("run", "--locked", "python", "-m", "backend.seed", "--agenda")
    $env:DEMO_MODE = "1"
    & uv run --locked uvicorn backend.web:app --host 127.0.0.1 --port 8000
}
finally {
    $env:DEMO_MODE = $PreviousDemoMode
    Pop-Location
}
