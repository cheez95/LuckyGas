# ValidationUtils Path Fix Required

**Issue**: ValidationUtils is referenced in app.js but files are in wrong location

## Current Situation

### Files Location:
- `/src/main/js/utils/validation.js` ✅ EXISTS
- `/src/main/js/utils/sanitization.js` ✅ EXISTS

### index.html References:
- Tries to load from `/utils/validation.js` ❌
- Tries to load from `/utils/sanitization.js` ❌

### Web Server Root:
- Serves from `/src/main/python/web/`
- So `/utils/` would look in `/src/main/python/web/utils/` (doesn't exist)

## Solution Options

### Option 1: Move Files (Recommended)
```bash
mkdir -p /Users/lgee258/Desktop/LuckyGas/src/main/python/web/utils
cp /Users/lgee258/Desktop/LuckyGas/src/main/js/utils/validation.js /Users/lgee258/Desktop/LuckyGas/src/main/python/web/utils/
cp /Users/lgee258/Desktop/LuckyGas/src/main/js/utils/sanitization.js /Users/lgee258/Desktop/LuckyGas/src/main/python/web/utils/
```

### Option 2: Update Static Mount in FastAPI
Add to `src/main/python/api/main.py`:
```python
app.mount("/js", StaticFiles(directory=js_path), name="js")
```
Then update index.html to use `/js/utils/validation.js`

### Option 3: Copy During Build
Add a build step to copy files to the correct location

## Impact
Without this fix:
- ValidationUtils will be undefined
- Form validation will fail
- Error: "ValidationUtils is not defined"

## Recommendation
Use Option 1 - move files to match expected paths. This is the simplest fix that doesn't require code changes.