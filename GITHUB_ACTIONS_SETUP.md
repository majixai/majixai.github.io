# GitHub Actions Permissions Setup

## ✅ Workflow Fixed

The workflow has been updated to use native Git commands instead of third-party actions, which should resolve the permission issues.

## 🔧 Repository Settings (Important!)

You need to configure your GitHub repository settings to allow the workflow to push changes:

### Step 1: Enable Workflow Permissions

1. Go to your repository on GitHub: https://github.com/majixai/majixai.github.io
2. Click **Settings** (top navigation)
3. Click **Actions** in the left sidebar
4. Click **General**
5. Scroll down to **Workflow permissions**
6. Select: **"Read and write permissions"**
7. ✅ Check: **"Allow GitHub Actions to create and approve pull requests"**
8. Click **Save**

### Visual Guide:

```
Settings → Actions → General → Workflow permissions

● Read repository contents and packages permissions
○ Read and write permissions  ← SELECT THIS

☑ Allow GitHub Actions to create and approve pull requests  ← CHECK THIS
```

## 🔑 Alternative: Use Personal Access Token (Optional)

If you want extra control, you can use a Personal Access Token (PAT):

### Create a PAT:

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Name it: `YFINANCE_UPDATER`
4. Set expiration: **No expiration** (or your preference)
5. Select scopes:
   - ✅ **repo** (Full control of private repositories)
   - ✅ **workflow** (Update GitHub Action workflows)
6. Click **Generate token**
7. **Copy the token** (you won't see it again!)

### Add PAT to Repository:

1. Go to your repository: https://github.com/majixai/majixai.github.io
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Name: `GH_PAT`
5. Value: Paste your PAT token
6. Click **Add secret**

The workflow is already configured to use `GH_PAT` if available, or fall back to `GITHUB_TOKEN`.

## 🧪 Test the Workflow

After configuring permissions:

1. Go to: https://github.com/majixai/majixai.github.io/actions
2. Click **"YFinance Background Data Updater"**
3. Click **"Run workflow"** (right side)
4. Select branch: **Test**
5. Click **"Run workflow"** (green button)
6. Watch it run and verify it completes successfully!

## ✅ Verification Checklist

- [ ] Repository settings allow "Read and write permissions"
- [ ] "Allow GitHub Actions to create and approve pull requests" is checked
- [ ] Workflow file has `permissions: contents: write` (already done)
- [ ] Test run completes successfully
- [ ] Data files are committed to repository

## 🔍 What Changed in the Workflow

The updated workflow now:
- Uses native `git` commands instead of third-party actions
- Explicitly configures Git user identity
- Uses `persist-credentials: true` to maintain authentication
- Checks for changes before committing (avoids empty commits)
- Has better error handling with `|| true` for optional operations

## 📝 Key Changes:

**Before** (used third-party action):
```yaml
- name: Commit and push changes
  uses: stefanzweifel/git-auto-commit-action@v5
```

**After** (uses native git):
```yaml
- name: Configure Git
  run: |
    git config --global user.name "github-actions[bot]"
    git config --global user.email "github-actions[bot]@users.noreply.github.com"

- name: Commit and push changes
  run: |
    git add yfinance_index_1m/*.json || true
    # ... more git commands
    git commit -m "🤖 Auto-update: YFinance data"
    git push
```

This approach is more reliable and doesn't require additional permissions for third-party actions.

## 🚀 Next Steps

1. **Configure repository settings** (see Step 1 above)
2. **Commit and push** the updated workflow:
   ```bash
   git add .github/workflows/yfinance_background_updater.yml
   git commit -m "Fix GitHub Actions permissions for auto-commits"
   git push
   ```
3. **Test the workflow** manually from GitHub Actions tab
4. **Monitor** the automatic runs during market hours

## ❓ Still Having Issues?

If you still encounter permission errors:

1. **Check branch protection rules**: Settings → Branches
   - Make sure the `Test` branch doesn't have restrictions that block GitHub Actions
   
2. **Verify authentication**: 
   - The workflow uses `${{ secrets.GITHUB_TOKEN }}` by default
   - This token should have write permissions when settings are configured correctly

3. **Check workflow logs**:
   - Go to Actions tab → Click on the failed run
   - Check the "Commit and push changes" step for detailed error messages

4. **Force a fresh checkout**:
   - The workflow now uses `fetch-depth: 0` for full history
   - Uses `persist-credentials: true` to maintain auth

---

**Need Help?** Check the workflow logs in the Actions tab for detailed error messages.
