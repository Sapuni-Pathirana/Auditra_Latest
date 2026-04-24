import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/theme_service.dart';
import '../theme/app_colors.dart';
import '../widgets/user_avatar.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _profile;
  bool _loading = true;
  String? _error;

  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _bioCtrl = TextEditingController();
  bool _saving = false;
  bool _uploading = false;
  String? _avatarUrl;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    final result = await ApiService.getUserProfile();
    if (!mounted) return;
    if (result['success'] == true) {
      final data = result['data'] as Map<String, dynamic>;
      final profile = (data['profile'] as Map?)?.cast<String, dynamic>() ?? {};
      setState(() {
        _profile = data;
        _firstNameCtrl.text = data['first_name'] ?? '';
        _lastNameCtrl.text = data['last_name'] ?? '';
        _phoneCtrl.text = profile['phone'] ?? '';
        _bioCtrl.text = profile['bio'] ?? '';
        _avatarUrl = profile['profile_image_url'];
        _loading = false;
      });

      // Feature #16: hydrate ThemeService with the server preference.
      final serverTheme = profile['theme_preference'];
      if (serverTheme is String) {
        // ignore: use_build_context_synchronously
        Provider.of<ThemeService>(context, listen: false)
            .applyServerPreference(serverTheme);
      }
    } else {
      setState(() { _error = result['message']; _loading = false; });
    }
  }

  Future<void> _save() async {
    setState(() { _saving = true; });
    final result = await ApiService.updateUserProfile({
      'first_name': _firstNameCtrl.text.trim(),
      'last_name': _lastNameCtrl.text.trim(),
      'phone': _phoneCtrl.text.trim(),
      'bio': _bioCtrl.text.trim(),
    });
    if (!mounted) return;
    setState(() { _saving = false; });
    if (result['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile updated'), backgroundColor: AppColors.success),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result['message'] ?? 'Update failed'), backgroundColor: AppColors.error),
      );
    }
  }

  Future<void> _pickAvatar() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1024,
      imageQuality: 85,
    );
    if (picked == null || !mounted) return;
    setState(() { _uploading = true; });
    final res = await ApiService.uploadUserAvatar(File(picked.path));
    if (!mounted) return;
    setState(() { _uploading = false; });
    if (res['success'] == true) {
      final url = (res['data'] as Map?)?['profile_image_url'] as String?;
      setState(() { _avatarUrl = url; });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Avatar updated'), backgroundColor: AppColors.success),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res['message'] ?? 'Upload failed'), backgroundColor: AppColors.error),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final themeService = Provider.of<ThemeService>(context);
    final roleInfo = (_profile?['role_info'] as Map?)?.cast<String, dynamic>() ?? const {};
    final roleLabel = roleInfo['role_display'] ?? roleInfo['role'] ?? '';

    return Scaffold(
      appBar: AppBar(title: const Text('My Profile')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Center(
                        child: Stack(
                          alignment: Alignment.bottomRight,
                          children: [
                            UserAvatar(
                              imageUrl: _avatarUrl,
                              firstName: _firstNameCtrl.text,
                              lastName: _lastNameCtrl.text,
                              username: _profile?['username'],
                              radius: 48,
                            ),
                            Positioned(
                              bottom: -4,
                              right: -4,
                              child: Material(
                                color: AppColors.primary,
                                shape: const CircleBorder(),
                                child: InkWell(
                                  customBorder: const CircleBorder(),
                                  onTap: _uploading ? null : _pickAvatar,
                                  child: Padding(
                                    padding: const EdgeInsets.all(6),
                                    child: _uploading
                                        ? const SizedBox(
                                            height: 16,
                                            width: 16,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: Colors.white,
                                            ),
                                          )
                                        : const Icon(Icons.camera_alt,
                                            color: Colors.white, size: 18),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      Center(
                        child: Text(
                          roleLabel.toString(),
                          style: TextStyle(color: AppColors.textSecondary),
                        ),
                      ),
                      const SizedBox(height: 24),
                      _sectionLabel('Personal Info'),
                      _field('First Name', _firstNameCtrl),
                      _field('Last Name', _lastNameCtrl),
                      _field('Phone', _phoneCtrl),
                      _field('Bio', _bioCtrl, maxLines: 3),
                      const SizedBox(height: 24),
                      _sectionLabel('Preferences'),
                      Card(
                        child: ListTile(
                          leading: const Icon(Icons.brightness_6),
                          title: const Text('Theme'),
                          trailing: DropdownButton<String>(
                            value: themeService.preference,
                            underline: const SizedBox.shrink(),
                            items: const [
                              DropdownMenuItem(value: 'light', child: Text('Light')),
                              DropdownMenuItem(value: 'dark', child: Text('Dark')),
                              DropdownMenuItem(value: 'system', child: Text('System')),
                            ],
                            onChanged: (v) {
                              if (v != null) themeService.setMode(v);
                            },
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _saving ? null : _save,
                          child: _saving
                              ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : const Text('Save Changes'),
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }

  Widget _sectionLabel(String label) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
      );

  Widget _field(String label, TextEditingController ctrl, {int maxLines = 1}) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextField(
          controller: ctrl,
          maxLines: maxLines,
          decoration: InputDecoration(labelText: label),
        ),
      );
}
