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

    // We'll use a simpler replacement for loading blocks that return a div.
    // Replace:
    // if (loading) { return ( <div ... > ... animate-spin ... </div> ); }
    content = content.replace(
      /if\s*\(\s*loading\s*\)\s*\{\s*return\s*\(\s*<div[\s\S]*?animate-spin[\s\S]*?\);\s*\}/g,
      'if (loading) return <LoadingScreen fullScreen={false} size={150} />;'
    );

    // Replace:
    // if (loading) return ( <div ... > ... animate-spin ... </div> );
    content = content.replace(
      /if\s*\(\s*loading\s*\)\s*return\s*\(\s*<div[\s\S]*?animate-spin[\s\S]*?\);/g,
      'if (loading) return <LoadingScreen fullScreen={false} size={150} />;'
    );

    // Replace:
    // if (loading) return <div ... > ... animate-spin ... </div>;
    // We match until the first semicolon.
    content = content.replace(
      /if\s*\(\s*loading\s*\)\s*return\s*<div[\s\S]*?animate-spin[\s\S]*?div>\s*;/g,
      'if (loading) return <LoadingScreen fullScreen={false} size={150} />;'
    );

    if (original !== content && !content.includes('LoadingScreen')) {
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
