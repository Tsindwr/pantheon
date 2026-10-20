param(
    [string]$CsvPath = (Join-Path $PSScriptRoot "creosmark-ux-github-issues.csv"),
    [string]$Repository = "",
    [switch]$Execute,
    [switch]$EnsureMetadata,
    [switch]$SkipLabels,
    [switch]$SkipMilestones
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $CsvPath)) {
    throw "CSV not found: $CsvPath"
}

$ghCommand = Get-Command gh -ErrorAction SilentlyContinue
$ghExecutable = if ($ghCommand) { $ghCommand.Source } else { "" }

if (-not $ghExecutable) {
    $candidatePaths = @(
        (Join-Path $env:ProgramFiles "GitHub CLI\gh.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "GitHub CLI\gh.exe")
    ) | Where-Object { $_ }

    $ghExecutable = $candidatePaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}

if (-not $ghExecutable) {
    throw "GitHub CLI is required. Install gh or pass a shell where gh.exe is on PATH."
}

if (-not $Repository) {
    $Repository = (& $ghExecutable repo view --json nameWithOwner --jq ".nameWithOwner" 2>$null)
    if (-not $Repository) {
        throw "Could not infer repository. Pass -Repository owner/name."
    }
}

$rows = Import-Csv -LiteralPath $CsvPath

function Get-LabelColor {
    param([string]$Label)

    if ($Label -eq "ux") { return "5319E7" }
    if ($Label -eq "creosmark") { return "0E8A16" }
    if ($Label -like "priority:p0") { return "B60205" }
    if ($Label -like "priority:p1") { return "D93F0B" }
    if ($Label -like "priority:p2") { return "FBCA04" }
    if ($Label -like "phase:*") { return "1D76DB" }
    if ($Label -like "area:*") { return "C2E0C6" }
    if ($Label -like "type:*") { return "D4C5F9" }
    if ($Label -eq "accessibility") { return "0052CC" }
    if ($Label -eq "validation") { return "BFDADC" }
    if ($Label -eq "feedback") { return "FEF2C0" }
    if ($Label -eq "responsive") { return "BFD4F2" }
    if ($Label -eq "performance" -or $Label -eq "performance-perception") { return "006B75" }

    return "8B949E"
}

function Get-RepositoryApiPath {
    param([string]$RepositoryName)

    if ($RepositoryName -match "^[^/]+/[^/]+$") {
        return $RepositoryName
    }

    if ($RepositoryName -match "github\.com[:/](?<owner>[^/]+)/(?<repo>[^/]+?)(\.git)?$") {
        return "$($Matches.owner)/$($Matches.repo)"
    }

    throw "Repository must be owner/repo for milestone creation. Received: $RepositoryName"
}

if ($EnsureMetadata) {
    if (-not $SkipLabels) {
        $requiredLabels = @(
            $rows.Labels -split ";" |
                ForEach-Object { $_.Trim() } |
                Where-Object { $_ } |
                Sort-Object -Unique
        )
        $existingLabels = @(
            & $ghExecutable label list --repo $Repository --limit 1000 --json name --jq ".[].name"
        )

        foreach ($label in $requiredLabels) {
            if ($existingLabels -contains $label) {
                continue
            }

            $labelArgs = @(
                "label",
                "create",
                $label,
                "--repo",
                $Repository,
                "--color",
                (Get-LabelColor -Label $label),
                "--description",
                "Creosmark UX backlog"
            )

            if ($Execute) {
                & $ghExecutable @labelArgs
                if ($LASTEXITCODE -ne 0) {
                    throw "Failed creating label $label."
                }
            } else {
                Write-Host "DRY RUN: gh $($labelArgs -join " ")"
            }
        }
    }

    if (-not $SkipMilestones) {
        $repositoryApiPath = Get-RepositoryApiPath -RepositoryName $Repository
        $requiredMilestones = @(
            $rows.Milestone |
                Where-Object { $_ } |
                Sort-Object -Unique
        )
        $existingMilestones = @(
            & $ghExecutable api "repos/$repositoryApiPath/milestones?state=all&per_page=100" --jq ".[].title"
        )

        foreach ($milestone in $requiredMilestones) {
            if ($existingMilestones -contains $milestone) {
                continue
            }

            $milestoneArgs = @(
                "api",
                "--method",
                "POST",
                "repos/$repositoryApiPath/milestones",
                "-f",
                "title=$milestone",
                "--silent"
            )

            if ($Execute) {
                & $ghExecutable @milestoneArgs
                if ($LASTEXITCODE -ne 0) {
                    throw "Failed creating milestone $milestone."
                }
            } else {
                Write-Host "DRY RUN: gh $($milestoneArgs -join " ")"
            }
        }
    }
}

foreach ($row in $rows) {
    $body = $row.Body -replace "<br>", [Environment]::NewLine
    $args = @(
        "issue",
        "create",
        "--repo",
        $Repository,
        "--title",
        $row.Title,
        "--body",
        $body
    )

    if (-not $SkipLabels -and $row.Labels) {
        $labels = $row.Labels -split ";" | ForEach-Object { $_.Trim() } | Where-Object { $_ }
        foreach ($label in $labels) {
            $args += @("--label", $label)
        }
    }

    if (-not $SkipMilestones -and $row.Milestone) {
        $args += @("--milestone", $row.Milestone)
    }

    if ($Execute) {
        & $ghExecutable @args
        if ($LASTEXITCODE -ne 0) {
            throw "Failed creating issue $($row.Id)."
        }
    } else {
        Write-Host "DRY RUN: gh $($args -join " ")"
    }
}

if (-not $Execute) {
    Write-Host ""
    Write-Host "Dry run only. Re-run with -Execute to create issues."
}
