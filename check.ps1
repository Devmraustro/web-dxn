$out = "C:\Users\Utilisateur\Documents\web dxn\engine.out"
Remove-Item $out -ErrorAction SilentlyContinue
$ready = $false
for($i=0; $i -lt 8; $i++){
  $v = & docker info --format "{{.ServerVersion}}" 2>$null
  if($LASTEXITCODE -eq 0 -and $v){
    Add-Content -Path $out -Value "ENGINE_RESPONSIVE version=$v after=$((($i+1)*8))s"
    $ready = $true
    break
  }
  Start-Sleep -Seconds 8
}
if(-not $ready){ Add-Content -Path $out -Value "ENGINE_UNRESPONSIVE after_64s" }
