---
title: Role Policies
---

# Storage-agnostic role policies

`createRolePolicy` builds pure RBAC checks without coupling the policy to a database schema. The application can resolve roles from a membership table, a `users.role` column, token claims, or any other source.

```ts
import { createRolePolicy } from '@rdlabo/workers-hono-kit';

type Role = 'owner' | 'admin' | 'member' | 'read';
type Permission = 'organization.manage' | 'resource.write' | 'resource.read';

const policy = createRolePolicy<Role, Permission>({
  permissions: {
    owner: ['organization.manage', 'resource.write', 'resource.read'],
    admin: ['resource.write', 'resource.read'],
    member: ['resource.write', 'resource.read'],
    read: ['resource.read'],
  },
  assignableRoles: {
    owner: ['admin', 'member', 'read'],
    admin: ['member', 'read'],
    member: [],
    read: [],
  },
  manageableRoles: {
    owner: ['admin', 'member', 'read'],
    admin: ['member', 'read'],
    member: [],
    read: [],
  },
});
```

## Policy fields

- `permissions` maps a role to the set of permissions it grants.
- `assignableRoles` defines which roles an actor may grant to another subject.
- `manageableRoles` defines which existing subject roles an actor may manage.

The resulting `RolePolicy` has four pure checks:

```ts
policy.hasPermission('member', 'resource.write');        // true
policy.canAssignRole('admin', 'member');                 // true
policy.canManageRole('owner', 'admin');                  // true
policy.canChangeRole('owner', 'admin', 'member');        // true
```

`canChangeRole(actor, current, next)` is a combination: the actor must be able to manage the subject's current role and also be allowed to assign the next role. Keeping role lookup and policy checks separate means the same policy can be reused no matter where roles are stored.
