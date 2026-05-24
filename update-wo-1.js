const fs = require('fs');

const targetFile = 'app/(admin)/work-orders/create/page.tsx';
let content = fs.readFileSync(targetFile, 'utf-8');

// 1. Add imports
if (!content.includes('import imageCompression')) {
  content = content.replace(
    'import { db } from "@/lib/firebase";',
    'import { db, storage } from "@/lib/firebase";\nimport { ref, uploadBytes, getDownloadURL } from "firebase/storage";\nimport imageCompression from "browser-image-compression";'
  );
}

// 2. Add states
if (!content.includes('const [assignedToDivision')) {
  content = content.replace(
    'const [assignedToDept, setAssignedToDept] = useState(searchParams?.get("dept") || "");',
    'const [assignedToDept, setAssignedToDept] = useState(searchParams?.get("dept") || "");\n  const [assignedToDivision, setAssignedToDivision] = useState("");\n  const [photoFile, setPhotoFile] = useState<File | null>(null);\n  const [photoPreview, setPhotoPreview] = useState("");'
  );
}

// 3. Add divisions memo
if (!content.includes('const divisions = useMemo')) {
  content = content.replace(
    'const departments = useMemo(() => {',
    const divisions = useMemo(() => {
    if (!assignedToDept) return [];
    const divs = new Set(
      users
        .filter(u => u.department === assignedToDept && u.division)
        .map(u => u.division)
    );
    return Array.from(divs).sort();
  }, [users, assignedToDept]);

  const departments = useMemo(() => {
  );
}

// 4. Update data payload in handleSubmit
content = content.replace(
  'assignedToDept,',
  'assignedToDept,\n          assignedToDivision: assignedToDivision || null,'
);

// 5. Update form validation
if (!content.includes('setError("Mohon upload foto')) {
  content = content.replace(
    'if (!assignedToDept) {',
    if (!assignedToDept) {
      setError("Pilih departemen tujuan");
      return;
    }
    if (!photoFile) {
      setError("Mohon upload foto bukti terlebih dahulu");
      return;
    }
    if (!selectedArea) {
      setError("Mohon pilih Lokasi / Area");
      return;
    }
    if (!selectedItem && !isManualItem) {
      setError("Mohon pilih Barang Inventory");
      return;
    }
    if (isManualItem && !manualItemName) {
      setError("Mohon isi nama barang (Manual)");
      return;
    }
    // Prevent old duplicate if (!assignedToDept)
  );
  // Actually, replacing if (!assignedToDept) { with the above will duplicate the check, let's fix the regex.
}

fs.writeFileSync(targetFile, content, 'utf-8');
console.log('Done script 1');
