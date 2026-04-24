import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import User from '../models/user.models';
import AdminRequest from '../models/adminRequest.model';

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function sendAdminRequestEmail(
  requesterName: string,
  requesterEmail: string,
  reason: string,
  requestId: string
): Promise<void> {
  const transporter = getTransporter();

  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  if (!adminEmails.length) {
    console.warn('⚠️  No ADMIN_EMAILS configured — skipping notification.');
    return;
  }

  const html = `
  <div style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 30px;">
    <div style="max-width: 560px; margin: auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
      <div style="background: #1a1a2e; padding: 24px; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">Umurava</h1>
        <p style="color: #a0a0b0; margin: 4px 0 0; font-size: 13px;">AI Recruitment Platform</p>
      </div>
      <div style="padding: 32px 24px;">
        <h2 style="color: #1a1a2e; margin: 0 0 12px;">New Admin Permission Request</h2>
        <table style="width:100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <tr>
            <td style="padding: 8px 12px; background:#f0f0ff; font-weight:600;">Name</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${requesterName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; background:#f0f0ff; font-weight:600;">Email</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${requesterEmail}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; background:#f0f0ff; font-weight:600; vertical-align:top;">Reason</td>
            <td style="padding: 8px 12px; white-space:pre-wrap;">${reason}</td>
          </tr>
        </table>
        <p style="color: #888; font-size: 13px;">Request ID: <code>${requestId}</code></p>
        <p style="color: #555; font-size: 14px;">Go to the admin panel → <strong>Admin Requests</strong> to approve or reject.</p>
      </div>
      <div style="background: #f9f9f9; padding: 16px; text-align: center; font-size: 11px; color: #aaa;">
        &copy; ${new Date().getFullYear()} Umurava. All rights reserved.
      </div>
    </div>
  </div>`;

  await transporter.sendMail({
    from: `Umurava <${process.env.EMAIL_USER}>`,
    to: adminEmails.join(','),
    subject: `[Admin Request] ${requesterName} is requesting admin access`,
    html,
  });
}

async function sendRequestDecisionEmail(
  toEmail: string,
  toName: string,
  decision: 'approved' | 'rejected'
): Promise<void> {
  const transporter = getTransporter();

  const label = decision === 'approved' ? 'Approved ✅' : 'Rejected ❌';
  const color = decision === 'approved' ? '#22c55e' : '#ef4444';
  const body =
    decision === 'approved'
      ? 'Your request for admin access has been <strong>approved</strong>. You can now log in and start creating jobs.'
      : 'Your request for admin access has been <strong>rejected</strong>. Contact the administrator if you think this is a mistake.';

  const html = `
  <div style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 30px;">
    <div style="max-width: 500px; margin: auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
      <div style="background: #1a1a2e; padding: 24px; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">Umurava</h1>
        <p style="color: #a0a0b0; margin: 4px 0 0; font-size: 13px;">AI Recruitment Platform</p>
      </div>
      <div style="padding: 32px 24px;">
        <h2 style="color: ${color}; margin: 0 0 12px;">Admin Request ${label}</h2>
        <p style="color: #555; font-size: 14px;">Hi ${toName},</p>
        <p style="color: #555; font-size: 14px; line-height: 1.6;">${body}</p>
      </div>
      <div style="background: #f9f9f9; padding: 16px; text-align: center; font-size: 11px; color: #aaa;">
        &copy; ${new Date().getFullYear()} Umurava. All rights reserved.
      </div>
    </div>
  </div>`;

  await transporter.sendMail({
    from: `Umurava <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Your admin request has been ${decision}`,
    html,
  });
}

// POST /api/admin-requests
export const submitAdminRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    if (user.role === 'admin') {
      res.status(400).json({ message: 'You already have admin privileges.' });
      return;
    }

    const existing = await AdminRequest.findOne({ userId: user._id, status: 'pending' });
    if (existing) {
      res.status(400).json({ message: 'You already have a pending admin request.' });
      return;
    }

    const { reason } = req.body;
    if (!reason || reason.trim().length < 10) {
      res.status(400).json({ message: 'Please provide a reason (at least 10 characters).' });
      return;
    }

    const adminRequest = await AdminRequest.create({
      userId: user._id,
      reason: reason.trim(),
    });

    sendAdminRequestEmail(user.name, user.email, reason.trim(), String(adminRequest._id)).catch(
      (err) => console.error('⚠️  Failed to send admin-request email:', err.message)
    );

    res.status(201).json({
      success: true,
      message: 'Request submitted. You will be notified by email once reviewed.',
      requestId: adminRequest._id,
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ message: error.message });
  }
};

// GET /api/admin-requests/my
export const getMyAdminRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const requests = await AdminRequest.find({ userId: req.user!._id }).sort({ createdAt: -1 });
    res.json({ requests });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ message: error.message });
  }
};

// GET /api/admin-requests  (admin only)
export const listAdminRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query as { status?: string };
    const filter: Record<string, unknown> = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      filter.status = status;
    }

    const requests = await AdminRequest.find(filter)
      .populate('userId', 'name email companyName createdAt')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ total: requests.length, requests });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/admin-requests/:id/review  (admin only)
export const reviewAdminRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { decision } = req.body as { decision: 'approved' | 'rejected' };
    if (!['approved', 'rejected'].includes(decision)) {
      res.status(400).json({ message: "decision must be 'approved' or 'rejected'." });
      return;
    }

    const adminRequest = await AdminRequest.findById(req.params.id).populate<{
      userId: { _id: string; name: string; email: string };
    }>('userId', 'name email');

    if (!adminRequest) {
      res.status(404).json({ message: 'Admin request not found.' });
      return;
    }
    if (adminRequest.status !== 'pending') {
      res.status(400).json({ message: `Request is already ${adminRequest.status}.` });
      return;
    }

    adminRequest.status     = decision;
    adminRequest.reviewedBy = req.user!._id as unknown as mongoose.Types.ObjectId;
    adminRequest.reviewedAt = new Date();
    await adminRequest.save();

    if (decision === 'approved') {
      await User.findByIdAndUpdate(adminRequest.userId._id, { role: 'admin' });
    }

    const requester = adminRequest.userId as { name: string; email: string };
    sendRequestDecisionEmail(requester.email, requester.name, decision).catch((err) =>
      console.error('⚠️  Failed to send decision email:', err.message)
    );

    res.json({
      success: true,
      message: `Request ${decision}.${decision === 'approved' ? ' User promoted to admin.' : ''}`,
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ message: error.message });
  }
};