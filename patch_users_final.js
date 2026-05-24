const fs = require('fs');
const path = 'C:\\Users\\Agung\\web-admin\\app\\(admin)\\users\\page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update imports
content = content.replace(
  'import {\n  collection,\n  getDocs,\n  doc,\n  setDoc,\n  updateDoc,\n  deleteDoc,\n  Timestamp,\n} from "firebase/firestore";',
  'import {\n  collection,\n  getDocs,\n  doc,\n  setDoc,\n  updateDoc,\n  deleteDoc,\n  Timestamp,\n  query,\n  limit,\n  where,\n  onSnapshot,\n  getCountFromServer\n} from "firebase/firestore";'
);

// 2. Add limits and state
content = content.replace(
  '  const [searchTerm, setSearchTerm] = useState("");\n  const [filterRole, setFilterRole] = useState("ALL");\n\n  const [departmentsList, setDepartmentsList] = useState<Department[]>([]);',
  '  const [searchTerm, setSearchTerm] = useState("");\n  const [filterRole, setFilterRole] = useState("ALL");\n  const [limitValue, setLimitValue] = useState(20);\n  const [totalUsersCount, setTotalUsersCount] = useState(0);\n\n  const [departmentsList, setDepartmentsList] = useState<Department[]>([]);'
);

// 3. Replace loadUsers and useEffect
content = content.replace(
  '  useEffect(() => {\n    loadUsers();\n    loadDepartments();\n  }, []);',
  '  useEffect(() => {\n    loadDepartments();\n    fetchTotalCount();\n  }, []);\n\n  const fetchTotalCount = async () => {\n    try {\n      const snap = await getCountFromServer(collection(db, "users"));\n      setTotalUsersCount(snap.data().count);\n    } catch (error) {\n      console.error("Error fetching total count:", error);\n    }\n  };\n\n  useEffect(() => {\n    setLoading(true);\n    let constraints: any[] = [];\n    \n    if (filterRole !== "ALL") {\n      constraints.push(where("role", "==", filterRole));\n    }\n    \n    constraints.push(limit(limitValue));\n    \n    const q = query(collection(db, "users"), ...constraints);\n    \n    const unsubscribe = onSnapshot(q, (snapshot) => {\n      const arr: User[] = [];\n      snapshot.forEach((doc) => {\n        arr.push({ id: doc.id, ...doc.data() } as User);\n      });\n      setUsers(arr);\n      setLoading(false);\n    }, (error) => {\n      console.error("Error loading users:", error);\n      setLoading(false);\n    });\n\n    return () => unsubscribe();\n  }, [limitValue, filterRole]);'
);

// 4. Remove the old loadUsers function completely
content = content.replace(/  const loadUsers = async \(\) => \{[\s\S]*?finally \{\s*setLoading\(false\);\s*\}\s*\};\n/g, '');

// 5. Replace loadUsers() calls
content = content.replace(/loadUsers\(\);/g, '// loadUsers(); // Using onSnapshot');

// 6. Replace Stats Cards block using slices
const statsStart = content.indexOf('        {/* Stats Cards */}');
const statsEnd = content.indexOf('        {/* Search & Filter */}');
if (statsStart !== -1 && statsEnd !== -1) {
  content = content.slice(0, statsStart) + 
`        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Users</p>
              <p className="text-2xl font-bold text-slate-800">{totalUsersCount > 0 ? totalUsersCount : users.length}</p>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Active</p>
              <p className="text-2xl font-bold text-slate-800">{users.filter((u) => u.isActive).length}</p>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Inactive</p>
              <p className="text-2xl font-bold text-slate-800">{users.filter((u) => !u.isActive).length}</p>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Departments</p>
              <p className="text-2xl font-bold text-slate-800">{new Set(users.map((u) => u.department).filter(Boolean)).size}</p>
            </div>
          </div>
        </div>

` + content.slice(statsEnd);
}

// 7. Remove emojis from Action Buttons and standardize colors
const actionStart = content.indexOf('        {/* Action Buttons */}');
const actionEnd = content.indexOf('        {/* Modal form Add / Edit User */}');
if (actionStart !== -1 && actionEnd !== -1) {
  content = content.slice(0, actionStart) + 
`        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-sm"
          >
            {showForm ? "Close Form" : "Add User"}
          </button>
          <button
            onClick={triggerFileUpload}
            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-sm"
          >
            Upload Excel
          </button>
          <button
            onClick={importFromGoogleSheets}
            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-sm"
          >
            Google Sheets
          </button>
          <button
            onClick={downloadTemplate}
            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-sm"
          >
            Template
          </button>
        </div>

` + content.slice(actionEnd);
}

// 8. Update Table Actions
const tableActionsStart = content.indexOf('                      <div className="flex gap-2 flex-wrap">');
const tableActionsEnd = content.indexOf('                      </div>\\n                    </td>', tableActionsStart);
if (tableActionsStart !== -1) {
  content = content.replace(
    /                      <div className="flex gap-2 flex-wrap">[\s\S]*?<\/div>\s*<\/td>/g,
    `                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          onClick={() => editUser(user)}
                          className="text-slate-500 hover:text-slate-800 text-xs font-medium transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openPermissionsModal(user)}
                          className="text-slate-500 hover:text-slate-800 text-xs font-medium transition-colors"
                          title="Hak Akses Khusus"
                        >
                          Akses
                        </button>
                        <button
                          onClick={() => resetPassword(user.email)}
                          className="text-slate-500 hover:text-slate-800 text-xs font-medium transition-colors"
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => toggleActive(user)}
                          className={\`text-xs font-medium transition-colors \${
                            user.isActive
                              ? "text-red-500 hover:text-red-700"
                              : "text-emerald-500 hover:text-emerald-700"
                          }\`}
                        >
                          {user.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => deleteUser(user)}
                          className="text-slate-500 hover:text-red-600 text-xs font-medium transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>`
  );
}

// 9. Add Pagination / Load More button safely
const emptyTableStart = content.indexOf('            {filteredUsers.length === 0 && (');
const modalStart = content.indexOf('      {/* MODAL DETAIL USER - konten sama */}');
if (emptyTableStart !== -1 && modalStart !== -1) {
  content = content.slice(0, emptyTableStart) + 
`            {filteredUsers.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <div className="text-5xl mb-4">👥</div>
                <p className="text-lg font-medium">No users found</p>
              </div>
            )}
          </div>
          
          {/* Pagination / Load More */}
          {users.length >= limitValue && (
            <div className="p-4 border-t border-slate-100 flex justify-center bg-white rounded-b-xl shadow-sm border border-t-0 border-slate-200">
              <button
                onClick={() => setLimitValue(prev => prev + 20)}
                className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 font-medium text-sm rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
              >
                Load More Users ({users.length} loaded)
              </button>
            </div>
          )}
        </div>
      </div>

` + content.slice(modalStart);
}

// 10. Update filterRole resets
content = content.replace(/onChange=\{\(e\) => setFilterRole\(e\.target\.value\)\}/g, 'onChange={(e) => { setFilterRole(e.target.value); setLimitValue(20); }}');
content = content.replace(/setFilterRole\("ALL"\);/g, 'setFilterRole("ALL"); setLimitValue(20);');

// 11. Remove matchesRole from client-side filter
content = content.replace(
  '  const filteredUsers = users.filter((user) => {\n    const matchesSearch =\n      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||\n      user.email.toLowerCase().includes(searchTerm.toLowerCase());\n    const matchesRole = filterRole === "ALL" || user.role === filterRole;\n    return matchesSearch && matchesRole;\n  });',
  '  const filteredUsers = users.filter((user) => {\n    const matchesSearch =\n      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||\n      user.email.toLowerCase().includes(searchTerm.toLowerCase());\n    return matchesSearch; // Role is already filtered on the server\n  });'
);

fs.writeFileSync(path, content, 'utf8');
console.log("Successfully patched via Node safely");
