import re

with open(r'C:\Users\Agung\web-admin\app\(admin)\users\page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update imports
content = content.replace(
    'import { useEffect, useState } from "react";\nimport { db, auth, storage } from "@/lib/firebase";\nimport {\n  collection,\n  getDocs,\n  doc,\n  setDoc,\n  updateDoc,\n  deleteDoc,\n  Timestamp,\n} from "firebase/firestore";',
    'import { useEffect, useState } from "react";\nimport { db, auth, storage } from "@/lib/firebase";\nimport {\n  collection,\n  getDocs,\n  doc,\n  setDoc,\n  updateDoc,\n  deleteDoc,\n  Timestamp,\n  query,\n  limit,\n  where,\n  onSnapshot,\n  getCountFromServer\n} from "firebase/firestore";'
)

# 2. Add limitValue state
content = content.replace(
    'const [filterRole, setFilterRole] = useState("ALL");\n\n  const [departmentsList',
    'const [filterRole, setFilterRole] = useState("ALL");\n  const [limitValue, setLimitValue] = useState(20);\n  const [totalUsersCount, setTotalUsersCount] = useState(0);\n\n  const [departmentsList'
)

# 3. Replace loadUsers and useEffect
old_use_effect = """  useEffect(() => {
    loadUsers();
    loadDepartments();
  }, []);"""

new_use_effect = """  useEffect(() => {
    loadDepartments();
    fetchTotalCount();
  }, []);

  const fetchTotalCount = async () => {
    try {
      const snap = await getCountFromServer(collection(db, "users"));
      setTotalUsersCount(snap.data().count);
    } catch (error) {
      console.error("Error fetching total count:", error);
    }
  };

  useEffect(() => {
    setLoading(true);
    let constraints: any[] = [];
    
    if (filterRole !== "ALL") {
      constraints.push(where("role", "==", filterRole));
    }
    
    constraints.push(limit(limitValue));
    
    const q = query(collection(db, "users"), ...constraints);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const arr: any[] = [];
      snapshot.forEach((doc) => {
        arr.push({ id: doc.id, ...doc.data() });
      });
      setUsers(arr);
      setLoading(false);
    }, (error) => {
      console.error("Error loading users:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [limitValue, filterRole]);"""

content = content.replace(old_use_effect, new_use_effect)

# Remove the old loadUsers function entirely
load_users_regex = re.compile(r'  const loadUsers = async \(\) => \{.*?\n  \};\n', re.DOTALL)
content = load_users_regex.sub('', content)

# Remove all loadUsers() calls
content = content.replace('loadUsers();', '// loadUsers(); // Now using onSnapshot')

# Update stat cards and REMOVE EMOJIS (Design Improvements)
old_stats = """        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
              <span className="text-xl">👥</span>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Users</p>
              <p className="text-2xl font-bold text-slate-800">{users.length}</p>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
              <span className="text-xl">✅</span>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Active</p>
              <p className="text-2xl font-bold text-slate-800">{users.filter((u) => u.isActive).length}</p>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0">
              <span className="text-xl">⛔</span>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Inactive</p>
              <p className="text-2xl font-bold text-slate-800">{users.filter((u) => !u.isActive).length}</p>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center shrink-0">
              <span className="text-xl">🏢</span>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Departments</p>
              <p className="text-2xl font-bold text-slate-800">{new Set(users.map((u) => u.department).filter(Boolean)).size}</p>
            </div>
          </div>
        </div>"""
new_stats = """        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
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
        </div>"""
content = content.replace(old_stats, new_stats)

old_filter = """  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === "ALL" || user.role === filterRole;
    return matchesSearch && matchesRole;
  });"""
new_filter = """  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch; // Role is already filtered on the server
  });"""
content = content.replace(old_filter, new_filter)

# Reset limitValue when changing role filter
content = content.replace('onChange={(e) => setFilterRole(e.target.value)}', 'onChange={(e) => { setFilterRole(e.target.value); setLimitValue(20); }}')
content = content.replace('setFilterRole("ALL");', 'setFilterRole("ALL"); setLimitValue(20);')

# Update action buttons and REMOVE EMOJIS
old_action_btns = """        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <span className="text-lg">+</span>
            {showForm ? "Close Form" : "Add User"}
          </button>
          <button
            onClick={triggerFileUpload}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <span className="text-lg">📁</span>
            Upload Excel
          </button>
          <button
            onClick={importFromGoogleSheets}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <span className="text-lg">📊</span>
            Google Sheets
          </button>
          <button
            onClick={downloadTemplate}
            className="bg-gray-600 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <span className="text-lg">📄</span>
            Template
          </button>
        </div>"""
new_action_btns = """        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
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
        </div>"""
content = content.replace(old_action_btns, new_action_btns)

# Update Table Header and REMOVE EMOJIS
old_table_header = """        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex justify-between items-center">
              <h2 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                <span>📋</span>
                User List
              </h2>"""
new_table_header = """        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-white">
            <div className="flex justify-between items-center">
              <h2 className="text-md font-semibold text-slate-800">
                User List
              </h2>"""
content = content.replace(old_table_header, new_table_header)

# Update Table Action Buttons and REMOVE EMOJIS
old_table_actions = """                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => editUser(user)}
                          className="px-2 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-xs transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openPermissionsModal(user)}
                          className="px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-xs transition-colors shadow-sm"
                          title="Hak Akses Khusus"
                        >
                          🔑
                        </button>
                        <button
                          onClick={() => resetPassword(user.email)}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs transition-colors"
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => toggleActive(user)}
                          className={`px-2 py-1 rounded-lg text-xs transition-colors ${
                            user.isActive
                              ? "bg-red-600 hover:bg-red-700 text-white"
                              : "bg-green-600 hover:bg-green-700 text-white"
                          }`}
                        >
                          {user.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => deleteUser(user)}
                          className="px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-xs transition-colors"
                        >
                          Delete
                        </button>
                      </div>"""
new_table_actions = """                      <div className="flex items-center gap-3 flex-wrap">
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
                          className={`text-xs font-medium transition-colors ${
                            user.isActive
                              ? "text-red-500 hover:text-red-700"
                              : "text-emerald-500 hover:text-emerald-700"
                          }`}
                        >
                          {user.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => deleteUser(user)}
                          className="text-slate-500 hover:text-red-600 text-xs font-medium transition-colors"
                        >
                          Delete
                        </button>
                      </div>"""
content = content.replace(old_table_actions, new_table_actions)

# Add Load More button below the table
load_more_jsx = """            {filteredUsers.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <div className="text-5xl mb-4">👥</div>
                <p className="text-lg font-medium">No users found</p>
              </div>
            )}
          </div>
          
          {/* Pagination / Load More */}
          {users.length >= limitValue && (
            <div className="p-4 border-t border-slate-100 flex justify-center bg-slate-50">
              <button
                onClick={() => setLimitValue(prev => prev + 20)}
                className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 font-medium text-sm rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
              >
                Load More Users ({users.length} loaded)
              </button>
            </div>
          )}
        </div>"""

content = content.replace("""            {filteredUsers.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <div className="text-5xl mb-4">👥</div>
                <p className="text-lg font-medium">No users found</p>
              </div>
            )}
          </div>
        </div>""", load_more_jsx)

# Just in case the fallback emoji matched:
content = content.replace("""            {filteredUsers.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <div className="text-5xl mb-4">dY`</div>
                <p className="text-lg font-medium">No users found</p>
              </div>
            )}
          </div>
        </div>""", load_more_jsx)

with open(r'C:\Users\Agung\web-admin\app\(admin)\users\page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Successfully patched users/page.tsx")
