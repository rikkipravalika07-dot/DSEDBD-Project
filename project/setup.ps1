Write-Host "Expense Splitter - Backend Setup" -ForegroundColor Cyan
Write-Host "This creates backend/.env using your local MySQL credentials." -ForegroundColor Yellow
$user = Read-Host "MySQL username (press Enter for root)"
if ([string]::IsNullOrWhiteSpace($user)) { $user = "root" }
$hostName = Read-Host "MySQL host (press Enter for localhost)"
if ([string]::IsNullOrWhiteSpace($hostName)) { $hostName = "localhost" }
$port = Read-Host "MySQL port (press Enter for 3306)"
if ([string]::IsNullOrWhiteSpace($port)) { $port = "3306" }
$secure = Read-Host "MySQL password" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
$jwt = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
@"
PORT=5000
JWT_SECRET=$jwt
DB_HOST=$hostName
DB_PORT=$port
DB_USER=$user
DB_PASSWORD=$password
DB_NAME=expense_splitter
"@ | Set-Content -Encoding UTF8 .env
Write-Host "Created backend/.env successfully." -ForegroundColor Green
Write-Host "Now run: npm install" -ForegroundColor White
Write-Host "Then run: npm run dev" -ForegroundColor White
