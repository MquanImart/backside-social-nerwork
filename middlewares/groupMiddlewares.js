const checkPermissions = async (groupId, userId, memberId) => {
  const group = await Group.findById(groupId)
  if (!group) throw new Error('Nhóm không tồn tại.')

  // Người tạo nhóm có quyền xóa tất cả thành viên
  if (group.idAdmin.toString() === userId) return true

  // Kiểm tra người dùng là quản trị viên
  const isAdmin = group.Administrators.some(
    (admin) => admin.idUser.toString() === userId && admin.state === 'accepted'
  )
  if (!isAdmin) throw new Error('Lỗi xác thực quyền.')

  // Quản trị viên không được xóa quản trị viên khác
  const isTargetAdmin = group.Administrators.some(
    (admin) =>
      admin.idUser.toString() === memberId && admin.state === 'accepted'
  )
  if (isTargetAdmin)
    throw new Error('Quản trị viên không thể xóa quản trị viên.')

  return true // Quản trị viên có quyền xóa thành viên
}

export const groupMiddlewares = {
  checkPermissions
}
