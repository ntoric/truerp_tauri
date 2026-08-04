/** Super Admin roles in TruERP (owner is the legacy bootstrap role). */
export function isSuperAdmin(role?: string | null): boolean {
  return role === 'owner' || role === 'super_admin'
}

/** Store-level admin who can manage users within their own store. */
export function isStoreAdmin(role?: string | null): boolean {
  return role === 'admin'
}

/** Super admin or store admin — can open User Management. */
export function canManageUsers(role?: string | null): boolean {
  return isSuperAdmin(role) || isStoreAdmin(role)
}

/** Roles a given actor may assign when creating/updating users. */
export function assignableRolesFor(actorRole?: string | null): { value: string; label: string }[] {
  if (isSuperAdmin(actorRole)) {
    return [
      { value: 'admin', label: 'Admin' },
      { value: 'staff', label: 'Staff' },
      { value: 'accountant', label: 'Accountant' },
      { value: 'manager', label: 'Manager' },
    ]
  }
  return [
    { value: 'admin', label: 'Admin' },
    { value: 'staff', label: 'Staff' },
  ]
}

export function roleLabel(role: string) {
  if (isSuperAdmin(role)) return 'Super Admin'
  if (role === 'admin') return 'Admin'
  if (role === 'staff') return 'Staff'
  if (role === 'accountant') return 'Accountant'
  if (role === 'manager') return 'Manager'
  return role
}
