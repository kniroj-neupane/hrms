import { env } from "@/env";
import { render } from "@react-email/render";
import { Resend } from "resend";
import { VerificationEmailTemplate } from "@/modules/email-templates/email-verification";
import { ResetPasswordEmailTemplate } from "@/modules/email-templates/reset-password-email";
import { ChangeEmailVerificationTemplate } from "@/modules/email-templates/change-email-verification";
import { EmployeeInvitationEmail } from "@/modules/email-templates/employee-invitation";

// Constructed lazily: Resend throws on a missing key at construction, and
// `next build` imports this module while collecting page data, before any
// runtime secrets exist.
let resendClient: Resend | undefined;

const getEmailConfig = () => {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    throw new Error(
      "Email is not configured. Set RESEND_API_KEY and EMAIL_FROM.",
    );
  }
  return {
    resend: (resendClient ??= new Resend(env.RESEND_API_KEY)),
    from: env.EMAIL_FROM,
  };
};

export const sendVerificationEmail = async ({
  email,
  verificationUrl,
}: {
  email: string;
  verificationUrl: string;
}) => {
  const { resend, from } = getEmailConfig();
  return await resend.emails.send({
    from,
    to: [email],
    subject: "Verify your Email address",
    html: await render(
      VerificationEmailTemplate({ inviteLink: verificationUrl }),
    ),
  });
};

export const sendResetPasswordEmail = async ({
  email,
  verificationUrl,
}: {
  email: string;
  verificationUrl: string;
}) => {
  const { resend, from } = getEmailConfig();
  return await resend.emails.send({
    from,
    to: [email],
    subject: "Reset Password Link",
    react: ResetPasswordEmailTemplate({ inviteLink: verificationUrl }),
  });
};

export const sendChangeEmailVerification = async ({
  email,
  verificationUrl,
}: {
  email: string;
  verificationUrl: string;
}) => {
  const { resend, from } = getEmailConfig();
  return await resend.emails.send({
    from,
    to: [email],
    subject: "Reset Password Link",
    react: ChangeEmailVerificationTemplate({ inviteLink: verificationUrl }),
  });
};

export const sendOrganizationInvitationEmail = async ({
  email,
  inviteLink,
  orgName,
  inviteId,
}: {
  email: string;
  inviteLink: string;
  orgName: string;
  inviteId?: string;
}) => {
  const { resend, from } = getEmailConfig();
  return await resend.emails.send({
    from,
    to: [email],
    subject: "Organization Invitation",
    react: EmployeeInvitationEmail({
      invitationLink: inviteLink,
      organizationName: orgName,
      email,
      invitationId: inviteId ?? "N/A",
    }),
  });
};
