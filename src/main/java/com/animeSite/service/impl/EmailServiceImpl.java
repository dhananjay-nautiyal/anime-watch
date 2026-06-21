package com.animeSite.service.impl;

import com.animeSite.service.EmailService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class EmailServiceImpl implements EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    @Value("${app.base-url}")
    private String baseUrl;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    public EmailServiceImpl(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @Async
    public void sendVerificationEmail(String to, String token) {
        sendEmail(to, "Verify your email - Anime Site",
                "Click the link below to verify your email:\n\n"
                + baseUrl + "/api/auth/verify?token=" + token);
    }

    @Async
    public void sendPasswordResetEmail(String to, String token) {
        sendEmail(to, "Reset your password - Anime Site",
                "Click the link below to reset your password:\n\n"
                + frontendUrl + "/reset-password?token=" + token
                + "\n\nThis link will expire in 1 hour.");
    }

    private void sendEmail(String to, String subject, String text) {
        if (fromEmail == null || fromEmail.isBlank()) {
            System.out.println("Email not configured: " + subject + " to " + to);
            return;
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromEmail);
        message.setTo(to);
        message.setSubject(subject);
        message.setText(text);
        mailSender.send(message);
    }
}
