package com.animeSite.service.impl;

import com.animeSite.constant.Role;
import com.animeSite.core.exception.BusinessException;
import com.animeSite.core.exception.ErrorCode;
import com.animeSite.model.LoginRequest;
import com.animeSite.model.RegisterRequest;
import com.animeSite.persist.PasswordResetToken;
import com.animeSite.persist.RefreshToken;
import com.animeSite.persist.User;
import com.animeSite.repo.PasswordResetTokenRepository;
import com.animeSite.repo.RefreshTokenRepository;
import com.animeSite.repo.UserRepository;
import com.animeSite.security.JwtTokenProvider;
import com.animeSite.service.AuthService;
import com.animeSite.service.EmailService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Service
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;
    private final EmailService emailService;

    public AuthServiceImpl(UserRepository userRepository,
                           RefreshTokenRepository refreshTokenRepository,
                           PasswordResetTokenRepository passwordResetTokenRepository,
                           PasswordEncoder passwordEncoder,
                           AuthenticationManager authenticationManager,
                           JwtTokenProvider jwtTokenProvider,
                           EmailService emailService) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtTokenProvider = jwtTokenProvider;
        this.emailService = emailService;
    }

    @Transactional
    public User register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException(ErrorCode.AUTH_0004, "Email already registered");
        }
        User user = new User();
        user.setName(request.getName());
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(Role.ROLE_USER);
        user.setVerified(true);
        user = userRepository.save(user);
        return user;
    }

    @Transactional
    public Map<String, Object> login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_0001));

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));
        } catch (BadCredentialsException e) {
            throw new BusinessException(ErrorCode.AUTH_0003);
        }

        String accessToken = jwtTokenProvider.generateToken(user.getEmail(), user.getRole().name());
        RefreshToken refreshToken = createRefreshToken(user);

        return Map.of(
                "token", accessToken,
                "refreshToken", refreshToken.getToken(),
                "email", user.getEmail(),
                "name", user.getName(),
                "role", user.getRole().name()
        );
    }

    @Transactional
    public Map<String, Object> refreshAccessToken(String refreshTokenValue) {
        RefreshToken rt = refreshTokenRepository.findByToken(refreshTokenValue)
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_0008, "Invalid refresh token"));
        if (rt.isExpired() || rt.isRevoked()) {
            throw new BusinessException(ErrorCode.AUTH_0010, "Refresh token expired or revoked");
        }
        rt.setRevoked(true);
        refreshTokenRepository.save(rt);

        User user = rt.getUser();
        String accessToken = jwtTokenProvider.generateToken(user.getEmail(), user.getRole().name());
        RefreshToken newRefreshToken = createRefreshToken(user);

        return Map.of(
                "token", accessToken,
                "refreshToken", newRefreshToken.getToken(),
                "email", user.getEmail(),
                "name", user.getName(),
                "role", user.getRole().name()
        );
    }

    @Transactional
    public void logout(String refreshTokenValue) {
        RefreshToken rt = refreshTokenRepository.findByToken(refreshTokenValue)
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_0008, "Invalid refresh token"));
        rt.setRevoked(true);
        refreshTokenRepository.save(rt);
    }

    @Transactional
    public void forgotPassword(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            String token = UUID.randomUUID().toString();
            PasswordResetToken prt = new PasswordResetToken();
            prt.setUser(user);
            prt.setToken(token);
            prt.setExpiresAt(LocalDateTime.now().plusHours(1));
            passwordResetTokenRepository.save(prt);
            emailService.sendPasswordResetEmail(user.getEmail(), token);
        });
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        PasswordResetToken prt = passwordResetTokenRepository.findByToken(token)
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_0006, "Invalid reset token"));
        if (prt.isExpired()) {
            throw new BusinessException(ErrorCode.AUTH_0007, "Reset token has expired");
        }
        User user = prt.getUser();
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        passwordResetTokenRepository.delete(prt);
    }

    private RefreshToken createRefreshToken(User user) {
        RefreshToken rt = new RefreshToken();
        rt.setUser(user);
        rt.setToken(UUID.randomUUID().toString());
        rt.setExpiresAt(LocalDateTime.now().plusDays(7));
        rt.setRevoked(false);
        return refreshTokenRepository.save(rt);
    }
}
