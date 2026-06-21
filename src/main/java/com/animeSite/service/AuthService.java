package com.animeSite.service;

import com.animeSite.model.LoginRequest;
import com.animeSite.model.RegisterRequest;
import com.animeSite.persist.User;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

public interface AuthService {
    User register(RegisterRequest request);
    Map<String, Object> login(LoginRequest request);
    Map<String, Object> refreshAccessToken(String refreshTokenValue);
    void logout(String refreshTokenValue);
    void forgotPassword(String email);
    void resetPassword(String token, String newPassword);
}
