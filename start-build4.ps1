$log = "C:\Users\Utilisateur\Documents\web dxn\docker-build4.log"
Remove-Item $log -ErrorAction SilentlyContinue
Remove-Item "$log.err" -ErrorAction SilentlyContinue
$p = Start-Process -FilePath "docker" -ArgumentList "build","-t","dxn-store:latest","." -WorkingDirectory "C:\Users\Utilisateur\Documents\web dxn" -RedirectStandardOutput $log -RedirectStandardError "$log.err" -WindowStyle Hidden -PassThru
Set-Content -Path "C:\Users\Utilisateur\Documents\web dxn\build4.pid" -Value $p.Id
Write-Output "started pid=$($p.Id)"
