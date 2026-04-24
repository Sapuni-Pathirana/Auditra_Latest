import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import '../services/api_service.dart';
import '../theme/app_colors.dart';

/// A self-contained widget embedded in the valuation form that
/// calculates depreciation via the backend catalog API.
class DepreciationWidget extends StatefulWidget {
  final String category;
  final void Function(Map<String, dynamic> result)? onResult;

  const DepreciationWidget({
    super.key,
    required this.category,
    this.onResult,
  });

  @override
  State<DepreciationWidget> createState() => _DepreciationWidgetState();
}

class _DepreciationWidgetState extends State<DepreciationWidget> {
  final _purchaseValueCtrl = TextEditingController();
  final _purchaseDateCtrl = TextEditingController();
  final _unitsUsedCtrl = TextEditingController();
  final _unitsLifetimeCtrl = TextEditingController();
  final _overrideCtrl = TextEditingController();

  String _method = 'straight_line';
  double? _computedBookValue;
  double? _depreciationAmount;
  bool _loading = false;
  bool _showOverride = false;

  @override
  void dispose() {
    _purchaseValueCtrl.dispose();
    _purchaseDateCtrl.dispose();
    _unitsUsedCtrl.dispose();
    _unitsLifetimeCtrl.dispose();
    _overrideCtrl.dispose();
    super.dispose();
  }

  Future<void> _calculate() async {
    final purchaseValue = double.tryParse(_purchaseValueCtrl.text.trim());
    if (purchaseValue == null) {
      _showError('Enter a valid purchase value');
      return;
    }

    setState(() { _loading = true; });

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');
      final body = {
        'category': widget.category,
        'purchase_value': purchaseValue,
        'purchase_date': _purchaseDateCtrl.text.trim(),
        'method': _method,
        if (_method == 'units_of_production') ...{
          'units_used': int.tryParse(_unitsUsedCtrl.text.trim()) ?? 0,
          if (_unitsLifetimeCtrl.text.trim().isNotEmpty)
            'units_lifetime': int.tryParse(_unitsLifetimeCtrl.text.trim()),
        },
      };

      final response = await http.post(
        Uri.parse('${ApiService.baseUrl}/catalog/depreciation/calculate/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode(body),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        setState(() {
          _computedBookValue = (data['book_value'] as num?)?.toDouble();
          _depreciationAmount = (data['depreciation_amount'] as num?)?.toDouble();
          _loading = false;
        });
        widget.onResult?.call({
          'method': _method,
          'computed_book_value': _computedBookValue,
          'depreciation_amount': _depreciationAmount,
          'override_reason': _showOverride ? _overrideCtrl.text.trim() : null,
          'applied_rate': data['applied_rate'],
        });
      } else {
        setState(() { _loading = false; });
        _showError('Calculation failed (${response.statusCode})');
      }
    } catch (e) {
      setState(() { _loading = false; });
      _showError(e.toString());
    }
  }

  void _showError(String msg) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: AppColors.error),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Depreciation', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _method,
              decoration: const InputDecoration(labelText: 'Method'),
              items: const [
                DropdownMenuItem(value: 'straight_line', child: Text('Straight-Line')),
                DropdownMenuItem(value: 'diminishing_balance', child: Text('Diminishing Balance')),
                DropdownMenuItem(value: 'units_of_production', child: Text('Units of Production')),
              ],
              onChanged: (v) => setState(() => _method = v ?? 'straight_line'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _purchaseValueCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Purchase Value'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _purchaseDateCtrl,
              decoration: const InputDecoration(labelText: 'Purchase Date (YYYY-MM-DD)'),
            ),
            if (_method == 'units_of_production') ...[
              const SizedBox(height: 8),
              TextField(
                controller: _unitsUsedCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Units Used'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _unitsLifetimeCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Units Lifetime (total)'),
              ),
            ],
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _loading ? null : _calculate,
                child: _loading
                    ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Calculate'),
              ),
            ),
            if (_computedBookValue != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.success.withAlpha(15),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.success.withAlpha(60)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Book Value: ${_computedBookValue!.toStringAsFixed(2)}',
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    Text('Depreciation: ${_depreciationAmount?.toStringAsFixed(2) ?? '-'}',
                        style: TextStyle(color: AppColors.textSecondary)),
                  ],
                ),
              ),
              CheckboxListTile(
                dense: true,
                title: const Text('Override depreciation'),
                value: _showOverride,
                onChanged: (v) => setState(() => _showOverride = v ?? false),
              ),
              if (_showOverride)
                TextField(
                  controller: _overrideCtrl,
                  decoration: const InputDecoration(labelText: 'Override reason'),
                  onChanged: (_) {
                    widget.onResult?.call({
                      'method': _method,
                      'computed_book_value': _computedBookValue,
                      'depreciation_amount': _depreciationAmount,
                      'override_reason': _overrideCtrl.text.trim(),
                    });
                  },
                ),
            ],
          ],
        ),
      ),
    );
  }
}
