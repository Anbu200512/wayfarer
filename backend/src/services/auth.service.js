import prisma from '../config/prisma.js';
import ApiError from '../utils/ApiError.js';
import { comparePassword, hashPassword } from '../utils/hash.js';
import { signToken } from '../utils/jwt.js';
import { userToJson } from '../utils/serialize.js';

const buildAuthResponse = (user) => ({
  user: userToJson(user),
  token: signToken({ sub: user.id, email: user.email }),
});

export const register = async ({ name, email, password }) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists. Try logging in instead.');
  }

  const user = await prisma.user.create({
    data: { name, email, password: await hashPassword(password) },
  });

  return buildAuthResponse(user);
};

export const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  const matches = await comparePassword(password, user.password);
  if (!matches) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  return buildAuthResponse(user);
};

export const getMe = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.unauthorized('Account no longer exists.');
  return { user: userToJson(user) };
};

export default { register, login, getMe };
