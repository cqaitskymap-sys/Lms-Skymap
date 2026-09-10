import type { UserProfile } from "@/types";
import type { OjtActor } from "@/types/ojt";

export function toOjtActor(profile: UserProfile): OjtActor {
  return {
    uid: profile.uid,
    name: profile.displayName,
    email: profile.email,
    role: profile.role,
    employeeId: profile.employeeId,
    departmentId: profile.departmentId,
    digitalSignatureUrl: profile.digitalSignatureUrl,
  };
}
