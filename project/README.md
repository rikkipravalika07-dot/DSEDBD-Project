# Expense Splitter Backend

## One-time setup (Windows / VS Code)

1. Make sure MySQL Server is running.
2. Open this `backend` folder in the VS Code terminal.
3. Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

4. Enter your MySQL username and password when asked. The password is not displayed while typing.
5. Then run:

```powershell
npm install
npm run dev
```

You should see:

`Expense Splitter API running at http://localhost:5000`

and, after a successful MySQL connection:

`MySQL database connected and tables are ready.`

## Frontend

Open a second VS Code terminal:

```powershell
cd ..\frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## Important

Do not put your real MySQL password in GitHub. The `.env` file is local configuration. If signup says `Registration failed`, check Terminal 1; this version prints the actual database/API error.
