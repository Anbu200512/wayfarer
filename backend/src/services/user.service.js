import prisma from '../config/prisma.js';
import ApiError from '../utils/ApiError.js';
import { comparePassword, hashPassword } from '../utils/hash.js';
import { userToJson } from '../utils/serialize.js';

export const updateProfile = async (userId, { name, bio, homeLocation }) => {
  const data = {};
  if (name !== undefined) data.name = name;
  if (bio !== undefined) data.bio = bio;
  if (homeLocation !== undefined) data.homeLocation = homeLocation;

  const user = await prisma.user.update({ where: { id: userId }, data });
  return { user: userToJson(user) };
};

export const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('Account not found.');

  const matches = await comparePassword(currentPassword, user.password);
  if (!matches) throw ApiError.badRequest('Current password is incorrect.');

  await prisma.user.update({
    where: { id: userId },
    data: { password: await hashPassword(newPassword) },
  });

  return { message: 'Password updated successfully.' };
};

export default { updateProfile, changePassword };
