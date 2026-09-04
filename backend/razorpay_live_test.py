"""
Razorpay Live Test & Integration CLI Script
FINCTRL AI — Razorpay Buildathon Track 04

Usage:
  # 1. Test Razorpay API Authentication & Fetch Account Data
  python razorpay_live_test.py --check-auth

  # 2. Create a Test Order on Razorpay
  python razorpay_live_test.py --create-order --amount 1499

  # 3. Create a Test Payment Link
  python razorpay_live_test.py --create-payment-link --amount 2500

  # 4. Fetch Live Payments, Settlements, and Refunds from Razorpay
  python razorpay_live_test.py --fetch-all

  # 5. Dispatch a signed live webhook to local FINCTRL backend (port 8000)
  python razorpay_live_test.py --send-webhook --event payment.captured --amount 2499
"""

import os
import sys
import hmac
import hashlib
import json
import time
import uuid
import argparse
import httpx
from dotenv import load_dotenv

# Load backend environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "finctrl_razorpay_webhook_secret_2026")
BACKEND_WEBHOOK_URL = os.getenv("FINCTRL_WEBHOOK_URL", "http://localhost:8000/api/webhooks/razorpay")

RAZORPAY_BASE_URL = "https://api.razorpay.com/v1"


def get_auth():
    if not KEY_ID or not KEY_SECRET:
        print("❌ Error: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env")
        sys.exit(1)
    return (KEY_ID, KEY_SECRET)


def check_auth():
    print(f"\n🔐 Checking Razorpay API authentication with Key ID: {KEY_ID}...")
    auth = get_auth()
    try:
        resp = httpx.get(f"{RAZORPAY_BASE_URL}/payments?count=1", auth=auth, timeout=10.0)
        if resp.status_code == 200:
            print("✅ Razorpay API authentication SUCCESSFUL! (HTTP 200 OK)")
            data = resp.json()
            print(f"   Total Payments on Account: {data.get('count', 0)}")
            return True
        else:
            print(f"❌ Razorpay API authentication FAILED: HTTP {resp.status_code}")
            print(f"   Response: {resp.text}")
            return False
    except Exception as e:
        print(f"❌ Network/Connection error: {e}")
        return False


def create_test_order(amount_inr: float = 1499.0):
    auth = get_auth()
    amount_paise = int(amount_inr * 100)
    receipt_id = f"rcpt_{uuid.uuid4().hex[:8]}"
    print(f"\n🛒 Creating Razorpay Test Order for ₹{amount_inr:.2f} ({amount_paise} paise)...")
    
    payload = {
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt_id,
        "notes": {
            "source": "FINCTRL AI Buildathon Live Test",
            "track": "Track 04 AI Finance Controller"
        }
    }
    
    try:
        resp = httpx.post(f"{RAZORPAY_BASE_URL}/orders", json=payload, auth=auth, timeout=10.0)
        if resp.status_code == 200:
            order = resp.json()
            print("✅ Order Created Successfully!")
            print(f"   • Order ID:   {order.get('id')}")
            print(f"   • Amount:     ₹{order.get('amount') / 100:.2f} {order.get('currency')}")
            print(f"   • Status:     {order.get('status')}")
            print(f"   • Receipt:    {order.get('receipt')}")
            return order
        else:
            print(f"❌ Failed to create order: HTTP {resp.status_code}")
            print(f"   Response: {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Error creating order: {e}")
        return None


def create_payment_link(amount_inr: float = 2500.0, description: str = "FINCTRL Test Invoice"):
    auth = get_auth()
    amount_paise = int(amount_inr * 100)
    ref_id = f"inv_{uuid.uuid4().hex[:8]}"
    print(f"\n🔗 Creating Razorpay Payment Link for ₹{amount_inr:.2f}...")
    
    payload = {
        "amount": amount_paise,
        "currency": "INR",
        "accept_partial": False,
        "reference_id": ref_id,
        "description": description,
        "customer": {
            "name": "Buildathon Test Merchant",
            "email": "test@finctrl.ai",
            "contact": "+919876543210"
        },
        "notify": {
            "sms": False,
            "email": False
        },
        "reminder_enable": False,
        "notes": {
            "project": "FINCTRL AI"
        }
    }
    
    try:
        resp = httpx.post(f"{RAZORPAY_BASE_URL}/payment_links", json=payload, auth=auth, timeout=10.0)
        if resp.status_code in (200, 201):
            link_data = resp.json()
            print("✅ Payment Link Created Successfully!")
            print(f"   • Link ID:       {link_data.get('id')}")
            print(f"   • Payment URL:   {link_data.get('short_url')}")
            print(f"   • Status:        {link_data.get('status')}")
            print(f"   • Amount:        ₹{link_data.get('amount') / 100:.2f}")
            return link_data
        else:
            print(f"❌ Failed to create payment link: HTTP {resp.status_code}")
            print(f"   Response: {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Error creating payment link: {e}")
        return None


def fetch_all():
    auth = get_auth()
    print("\n📦 Fetching recent records from your Razorpay Account...")
    
    for endpoint, label in [
        ("payments", "Payments"),
        ("settlements", "Settlements"),
        ("refunds", "Refunds"),
        ("orders", "Orders")
    ]:
        try:
            resp = httpx.get(f"{RAZORPAY_BASE_URL}/{endpoint}?count=10", auth=auth, timeout=10.0)
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("items", [])
                print(f"   • {label}: {data.get('count', len(items))} items found.")
                for item in items[:3]:
                    amt = item.get("amount", 0) / 100 if "amount" in item else "N/A"
                    print(f"     - [{item.get('id')}] Status: {item.get('status', 'N/A')} | Amount: ₹{amt}")
            else:
                print(f"   • {label}: HTTP {resp.status_code} ({resp.text[:60]})")
        except Exception as e:
            print(f"   • {label}: Error {e}")


def send_signed_webhook(event: str = "payment.captured", amount_inr: float = 2499.0, target_url: str = BACKEND_WEBHOOK_URL):
    amount_paise = int(amount_inr * 100)
    fee_paise = int(amount_inr * 0.02 * 100)
    tax_paise = int(fee_paise * 0.18)
    txn_id = f"pay_{uuid.uuid4().hex[:14]}"
    order_id = f"order_{uuid.uuid4().hex[:12]}"
    utr = f"UTR{uuid.uuid4().hex[:10].upper()}"
    
    print(f"\n⚡ Dispatching Signed Webhook '{event}' (₹{amount_inr:.2f}) -> {target_url}")
    
    payload = {
        "entity": "event",
        "account_id": "acc_buildathon_2026",
        "event": event,
        "contains": ["payment"],
        "payload": {
            "payment": {
                "entity": {
                    "id": txn_id,
                    "entity": "payment",
                    "amount": amount_paise,
                    "currency": "INR",
                    "status": "captured",
                    "order_id": order_id,
                    "method": "upi",
                    "fee": fee_paise,
                    "tax": tax_paise,
                    "acquirer_data": {
                        "bank_transaction_id": utr
                    },
                    "created_at": int(time.time())
                }
            }
        },
        "created_at": int(time.time())
    }
    
    raw_body = json.dumps(payload).encode("utf-8")
    sig = hmac.new(WEBHOOK_SECRET.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    
    headers = {
        "Content-Type": "application/json",
        "X-Razorpay-Signature": sig
    }
    
    try:
        resp = httpx.post(target_url, content=raw_body, headers=headers, timeout=5.0)
        if resp.status_code == 200:
            res_data = resp.json()
            print("✅ Webhook Delivered & Reconciled by FINCTRL!")
            print(f"   • Transaction ID:       {res_data.get('transaction_id')}")
            print(f"   • Reconciliation Status: {res_data.get('reconciliation_status')}")
            print(f"   • Engine Latency:        {res_data.get('latency_ms')} ms")
            print(f"   • Signature Verified:    {res_data.get('signature_verified')}")
            print(f"   👉 Check your UI Dashboard Live Feed to see this transaction!")
        else:
            print(f"❌ Webhook returned HTTP {resp.status_code}: {resp.text}")
    except httpx.ConnectError:
        print(f"⚠️ Could not connect to FINCTRL backend at {target_url}.")
        print("   Make sure backend is running: (e.g., `uvicorn app.main:app --reload --port 8000`)")
    except Exception as e:
        print(f"❌ Error sending webhook: {e}")


def main():
    parser = argparse.ArgumentParser(description="Razorpay Live Test & Integration CLI for FINCTRL AI")
    parser.add_argument("--check-auth", action="store_true", help="Verify Razorpay API credentials")
    parser.add_argument("--create-order", action="store_true", help="Create a test order on Razorpay")
    parser.add_argument("--create-payment-link", action="store_true", help="Create a live test payment link")
    parser.add_argument("--fetch-all", action="store_true", help="Fetch payments, settlements, refunds from Razorpay")
    parser.add_argument("--send-webhook", action="store_true", help="Send an HMAC-signed webhook to FINCTRL backend")
    parser.add_argument("--event", type=str, default="payment.captured", help="Webhook event type (default: payment.captured)")
    parser.add_argument("--amount", type=float, default=2499.0, help="Amount in INR (default: 2499.0)")
    parser.add_argument("--url", type=str, default=BACKEND_WEBHOOK_URL, help="Target webhook URL")
    
    args = parser.parse_args()
    
    if not any([args.check_auth, args.create_order, args.create_payment_link, args.fetch_all, args.send_webhook]):
        # Default action if no flag passed: check auth & show usage
        check_auth()
        print("\n💡 Tip: Run `python razorpay_live_test.py --help` to see all test commands.")
        return
        
    if args.check_auth:
        check_auth()
    if args.create_order:
        create_test_order(args.amount)
    if args.create_payment_link:
        create_payment_link(args.amount)
    if args.fetch_all:
        fetch_all()
    if args.send_webhook:
        send_signed_webhook(event=args.event, amount_inr=args.amount, target_url=args.url)


if __name__ == "__main__":
    main()
