import os

path = r"C:\Users\Agung\web-admin\app\(admin)\users\page.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old_form_dept = """                  <div>
                    <input
                      placeholder="Department (akan otomatis HURUF BESAR)"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                    />
                    {department && (
                      <p className="text-xs text-green-600 mt-1">
                        +' Akan disimpan sebagai: <span className="font-mono font-bold">{normalizeDepartment(department)}</span>
                      </p>
                    )}
                  </div>"""

new_form_dept = """                  <select
                    value={department}
                    onChange={(e) => { setDepartment(e.target.value); setSection(""); setDivision(""); }}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                  >
                    <option value="">-- Select Department --</option>
                    {departmentsList.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                    {department && <option value={department}>{department} (Selected)</option>}
                  </select>
                  
                  <select
                    value={section}
                    onChange={(e) => { setSection(e.target.value); setDivision(""); }}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                    disabled={!department || departmentsList.length === 0}
                  >
                    <option value="">-- Select Section --</option>
                    {departmentsList.find(d => d.name === department)?.sections?.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                    {section && <option value={section}>{section} (Selected)</option>}
                  </select>
                  
                  <select
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                    disabled={!section || departmentsList.length === 0}
                  >
                    <option value="">-- Select Division --</option>
                    {departmentsList.find(d => d.name === department)?.sections?.find(s => s.name === section)?.divisions?.map(div => (
                      <option key={div.id} value={div.name}>{div.name}</option>
                    ))}
                    {division && <option value={division}>{division} (Selected)</option>}
                  </select>"""

content = content.replace(old_form_dept, new_form_dept)

# Remove the fallback emoji
content = content.replace("""{editingId ? "o?,? Edit User" : "z  Add New User"}""", """{editingId ? "Edit User" : "Add New User"}""")
content = content.replace("""{editingId ? "o?,? Edit User" : "z  Add New User"}""", """{editingId ? "Edit User" : "Add New User"}""")
content = content.replace("""{editingId ? "o? Edit User" : "z  Add New User"}""", """{editingId ? "Edit User" : "Add New User"}""")
# One more regex to be sure
import re
content = re.sub(r'\{editingId \? "[^"]+Edit User" : "[^"]+Add New User"\}', '{"Edit User"}', content) # actually let's just do simple:
content = re.sub(r'\{editingId \? ".*?Edit User" : ".*?Add New User"\}', '{editingId ? "Edit User" : "Add New User"}', content)

# Fix table headers
old_th = """                    <th className="px-4 py-4 text-left">Department</th>
                    <th className="px-4 py-4 text-left">Role</th>"""
new_th = """                    <th className="px-4 py-4 text-left">Department</th>
                    <th className="px-4 py-4 text-left">Section</th>
                    <th className="px-4 py-4 text-left">Division</th>
                    <th className="px-4 py-4 text-left">Role</th>"""
content = content.replace(old_th, new_th)

# Fix table cells
old_td = """                      <td className="px-4 py-3">
                        <span className="font-mono text-slate-700 font-medium">{user.department || "-"}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{user.role}</td>"""
new_td = """                      <td className="px-4 py-3">
                        <span className="font-mono text-slate-700 font-medium">{user.department || "-"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-slate-700 font-medium">{user.section || "-"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-slate-700 font-medium">{user.division || "-"}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{user.role}</td>"""
content = content.replace(old_td, new_td)

# Fix user detail modal
old_modal_dept = """                      <div className="flex flex-col bg-gray-50 rounded-lg p-3">
                        <span className="text-gray-500">Department</span>
                        <span className="font-mono font-bold text-slate-700">{selectedUser.department || "-"}</span>
                      </div>"""
new_modal_dept = """                      <div className="flex flex-col bg-gray-50 rounded-lg p-3">
                        <span className="text-gray-500">Department</span>
                        <span className="font-mono font-bold text-slate-700">{selectedUser.department || "-"}</span>
                      </div>
                      <div className="flex flex-col bg-gray-50 rounded-lg p-3">
                        <span className="text-gray-500">Section</span>
                        <span className="font-mono font-bold text-slate-700">{selectedUser.section || "-"}</span>
                      </div>
                      <div className="flex flex-col bg-gray-50 rounded-lg p-3">
                        <span className="text-gray-500">Division</span>
                        <span className="font-mono font-bold text-slate-700">{selectedUser.division || "-"}</span>
                      </div>"""
content = content.replace(old_modal_dept, new_modal_dept)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("done")
