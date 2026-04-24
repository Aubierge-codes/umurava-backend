import { Router, Request, Response } from 'express';
import { signup, verifyEmail, login, googleAuth, forgotPassword, resetPassword, logout } from '../controllers/auth.controller';
import { signupValidation, loginValidation, authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/me', authenticate, (req: Request, res: Response) => {
  res.json({
    success: true,
    user: {
      id: req.user!._id,
      name: req.user!.name,
      email: req.user!.email,
      role: req.user!.role,
      companyName: req.user!.companyName || null,
    },
  });
});

router.post('/signup', signupValidation, signup);
router.post('/verify-email', verifyEmail);
router.post('/login', loginValidation, login);
router.post('/google', googleAuth);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', authenticate, logout);

export default router;
