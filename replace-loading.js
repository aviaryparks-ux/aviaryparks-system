const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./app/(admin)', function(filePath) {
  if (filePath.endsWith('page.tsx') || filePath.endsWith('layout.tsx')) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // We want to replace common loading spinner patterns that are returned directly.
    // e.g. return <div ... animate-spin ... </div>;
    // We only target large spinners (w-8, w-12, mx-auto, py-8) and not button spinners (w-4, w-5)
    
    // Pattern 1: if (loading) return <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" /></div>;
    content = content.replace(
      /if\s*\(\s*loading\s*\)\s*return\s*<div[^>]*>\s*<div[^>]*animate-spin[^>]*>\s*<\/div>\s*<\/div>\s*;/g,
      'if (loading) return <LoadingScreen fullScreen={false} size={150} />;'
    );

    // Pattern 2: if (loading) { return ( <div ...> <div ...animate-spin... /> </div> ); }
    content = content.replace(
      /if\s*\(\s*loading\s*\)\s*\{\s*return\s*\(\s*<div[^>]*>\s*<div[^>]*animate-spin[^>]*>\s*<\/div>\s*<\/div>\s*\);\s*\}/g,
      'if (loading) return <LoadingScreen fullScreen={false} size={150} />;'
    );

    // Pattern 3: <div className="...animate-spin mx-auto..."></div> inside a full screen or flex block
    // It's tricky to regex everything. Let's look for specific blocks.
    
    // Add import LoadingScreen if it was modified
    if (original !== content && !content.includes('LoadingScreen')) {
       // insert after "use client"; or at top
       if (content.includes('"use client";')) {
         content = content.replace('"use client";', '"use client";\nimport LoadingScreen from "@/components/ui/LoadingScreen";');
       } else {
         content = 'import LoadingScreen from "@/components/ui/LoadingScreen";\n' + content;
       }
    }
    
    if (original !== content) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log('Updated', filePath);
    }
  }
});
