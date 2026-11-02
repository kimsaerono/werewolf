export type HonorType = "mvp" | "svp" | "beiguo"

export interface Honors {
  mvp: string
  svp: string
  beiguo: string
}

export const HONOR_TYPES: HonorType[] = ["mvp", "svp", "beiguo"]

export function createHonors(): Honors {
  return { mvp: "", svp: "", beiguo: "" }
}

/** 点选荣誉：同类型再点一次取消；同一玩家只能占一个荣誉 */
export function toggleHonor(honors: Honors, type: HonorType, name: string): void {
  if (honors[type] === name) {
    honors[type] = ""
    return
  }
  honors[type] = name
  for (const other of HONOR_TYPES) {
    if (other !== type && honors[other] === name) honors[other] = ""
  }
}
