const fs = require('fs');

const path = 'C:\\Users\\Agung\\web-admin\\app\\(admin)\\users\\page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove all `loadUsers()` calls
content = content.replace(/loadUsers\(\);/g, '// loadUsers(); // Now using onSnapshot');

// 2. Remove emojis from Action Buttons and standardize colors
const oldActionBtns = `        {/* Action Buttons */}
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
        </div>`;
const newActionBtns = `        {/* Action Buttons */}
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
        </div>`;
content = content.replace(oldActionBtns, newActionBtns);

// 3. Update Table Actions
const oldTableActions = `                      <div className="flex gap-2 flex-wrap">
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
                          className={\`px-2 py-1 rounded-lg text-xs transition-colors \${
                            user.isActive
                              ? "bg-red-600 hover:bg-red-700 text-white"
                              : "bg-green-600 hover:bg-green-700 text-white"
                          }\`}
                        >
                          {user.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => deleteUser(user)}
                          className="px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-xs transition-colors"
                        >
                          Delete
                        </button>
                      </div>`;
const newTableActions = `                      <div className="flex items-center gap-3 flex-wrap">
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
                      </div>`;
content = content.replace(oldTableActions, newTableActions);

// 4. Update Stats Cards (using regex to ignore emojis and exact styling)
content = content.replace(
  /<div className="group relative overflow-hidden.*?Total Users.*?<\/p>[\s\S]*?<p className="text-3xl font-bold text-gray-800 mt-1">\{users\.length\}<\/p>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<div className="group relative overflow-hidden.*?Active.*?<\/p>[\s\S]*?<p className="text-3xl font-bold text-gray-800 mt-1">\{users\.filter\(\(u\) => u\.isActive\)\.length\}<\/p>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<div className="group relative overflow-hidden.*?Inactive.*?<\/p>[\s\S]*?<p className="text-3xl font-bold text-gray-800 mt-1">\{users\.filter\(\(u\) => !u\.isActive\)\.length\}<\/p>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<div className="group relative overflow-hidden.*?Departments.*?<\/p>[\s\S]*?<p className="text-3xl font-bold text-gray-800 mt-1">\{new Set\(users\.map\(\(u\) => u\.department\)\.filter\(Boolean\)\)\.size\}<\/p>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/g,
  `<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
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
          </div>`
);

// 5. Add Pagination / Load More button
const emptyTableStr = `              {filteredUsers.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  <div className="text-5xl mb-4">👥</div>
                  <p className="text-lg font-medium">No users found</p>
                </div>
              )}
            </div>
          </div>
        </div>`;
const newEmptyTableStr = `              {filteredUsers.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  <div className="text-5xl mb-4">👥</div>
                  <p className="text-lg font-medium">No users found</p>
                </div>
              )}
            </div>
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
        </div>`;
content = content.replace(emptyTableStr, newEmptyTableStr);

// fallback if emoji was mangled
content = content.replace(/<div className="text-5xl mb-4">.*?<\/div>[\s\S]*?<p className="text-lg font-medium">No users found<\/p>[\s\S]*?<\/div>[\s\S]*?\)}[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/g, newEmptyTableStr);

// 6. Update filterRole resets
content = content.replace(/onChange=\{\(e\) => setFilterRole\(e\.target\.value\)\}/g, 'onChange={(e) => { setFilterRole(e.target.value); setLimitValue(20); }}');
content = content.replace(/setFilterRole\("ALL"\);/g, 'setFilterRole("ALL"); setLimitValue(20);');

// 7. Remove matchesRole from client-side filter
const oldFilter = `  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === "ALL" || user.role === filterRole;
    return matchesSearch && matchesRole;
  });`;
const newFilter = `  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch; // Role is already filtered on the server
  });`;
content = content.replace(oldFilter, newFilter);

fs.writeFileSync(path, content, 'utf8');
console.log("Successfully patched via Node");
