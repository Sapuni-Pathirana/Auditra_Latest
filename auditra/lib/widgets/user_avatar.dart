import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// Shared avatar widget (Feature #16) that prefers the user's uploaded
/// profile image but falls back to initials on a coloured circle.
class UserAvatar extends StatelessWidget {
  final String? imageUrl;
  final String? firstName;
  final String? lastName;
  final String? username;
  final double radius;
  final TextStyle? textStyle;
  final Color? backgroundColor;

  const UserAvatar({
    super.key,
    this.imageUrl,
    this.firstName,
    this.lastName,
    this.username,
    this.radius = 20,
    this.textStyle,
    this.backgroundColor,
  });

  String get _initials {
    final f = (firstName ?? '').trim();
    final l = (lastName ?? '').trim();
    if (f.isNotEmpty || l.isNotEmpty) {
      final a = f.isNotEmpty ? f[0] : '';
      final b = l.isNotEmpty ? l[0] : '';
      return (a + b).toUpperCase();
    }
    final u = (username ?? '').trim();
    if (u.isNotEmpty) return u[0].toUpperCase();
    return '?';
  }

  @override
  Widget build(BuildContext context) {
    final bg = backgroundColor ?? AppColors.primary;
    if (imageUrl != null && imageUrl!.isNotEmpty) {
      return CircleAvatar(
        radius: radius,
        backgroundColor: bg,
        backgroundImage: NetworkImage(imageUrl!),
        onBackgroundImageError: (_, __) {},
        child: _initials.isEmpty
            ? null
            : const SizedBox.shrink(),
      );
    }
    return CircleAvatar(
      radius: radius,
      backgroundColor: bg,
      child: Text(
        _initials,
        style: textStyle ??
            TextStyle(
              fontSize: radius * 0.8,
              color: Colors.white,
              fontWeight: FontWeight.bold,
            ),
      ),
    );
  }
}
