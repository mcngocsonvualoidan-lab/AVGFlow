npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!"
    exit 1
}
firebase deploy
