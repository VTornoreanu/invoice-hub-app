import re
import json
import os
from datetime import datetime

def parse_sparkasse_txt(file_path):
    with open(file_path, 'r', encoding='latin-1') as f:
        lines = f.readlines()

    transactions = []
    current_year = "2025" # Fallback
    
    # Pre-pass to find any year hints
    for line in lines:
        match = re.search(r'(\d{2})\.(\d{2})\.(\d{4})', line)
        if match:
            current_year = match.group(3)
            # We don't break, we want the most recent one mentioned or just a starting point
    
    current_tx = None
    
    for i, line in enumerate(lines):
        # Update current year if we see a full date
        year_match = re.search(r'(\d{2})\.(\d{2})\.(\d{4})', line)
        if year_match:
            # Only update if it's a "per date" or footer date
            if "per" in line or "Digitales Banking" in line or "Abschlussbuchung" in line:
                current_year = year_match.group(3)

        # Transaction pattern: Description (whitespace) DDMM (whitespace) Amount
        # The DDMM is the "Wert" date.
        # Example: "Privat Entnahme                                         0412            500,00-"
        match = re.search(r'^(?P<desc>.{20,})\s+(?P<wert>\d{4})\s+(?P<amount>[\d\.,]+\s?-?)$', line)
        
        if match:
            # If we had a previous tx, save it
            if current_tx:
                transactions.append(current_tx)
            
            desc = match.group('desc').strip()
            wert = match.group('wert')
            amount_str = match.group('amount').strip()
            
            is_debit = amount_str.endswith('-')
            amount_clean = amount_str.replace('-', '').replace('.', '').replace(',', '.')
            try:
                amount = float(amount_clean)
                if is_debit:
                    amount = -amount
            except:
                amount = 0.0
                
            day = wert[:2]
            month = wert[2:]
            
            # Basic validation of day/month
            try:
                if int(month) > 12 or int(day) > 31:
                    continue # Not a valid date, likely not a tx
            except:
                continue

            date_str = f"{current_year}-{month}-{day}"
            
            # Counterparty detection: check next 1 or 2 lines
            counterparty = ""
            if i + 1 < len(lines):
                next_line = lines[i+1].strip()
                # If next line is indented and doesn't look like a new tx or header
                if next_line and len(lines[i+1]) - len(next_line) > 5:
                    if not re.search(r'\d{4}\s+[\d\.,]+\s?-?$', next_line):
                        counterparty = next_line
            
            current_tx = {
                "date": date_str,
                "description": desc,
                "counterparty": counterparty,
                "amount": amount
            }
        elif current_tx and line.strip() and "SPARKASSE" not in line:
            # Append more info to description if it's not a new tx
            # but only if it's clearly part of the tx (indented)
            if len(line) - len(line.lstrip()) > 5:
                stripped = line.strip()
                if not current_tx["counterparty"]:
                    current_tx["counterparty"] = stripped
                else:
                    if stripped not in current_tx["description"]:
                        current_tx["description"] += " | " + stripped
        
        # End of page or separator
        if "" in line or "Auszug/Blatt" in line:
            if current_tx:
                transactions.append(current_tx)
                current_tx = None

    if current_tx:
        transactions.append(current_tx)
        
    return transactions
                
    if current_tx:
        transactions.append(current_tx)
        
    return transactions

def main():
    directory = "/Users/virgil/Downloads/extrase_de_cont"
    all_transactions = []
    
    for filename in os.listdir(directory):
        if filename.endswith(".txt"):
            print(f"Parsing {filename}...")
            txs = parse_sparkasse_txt(os.path.join(directory, filename))
            all_transactions.extend(txs)
            
    # Remove duplicates (some transactions might be in both files)
    # Use a set of tuples or just compare key fields
    unique_txs = {}
    for tx in all_transactions:
        # Create a unique key
        key = (tx['date'], tx['amount'], tx['description'][:50])
        if key not in unique_txs:
            unique_txs[key] = tx
        else:
            # If duplicate, maybe merge info?
            pass
            
    sorted_txs = sorted(unique_txs.values(), key=lambda x: x['date'], reverse=True)
    
    with open(os.path.join(directory, "transactions.json"), "w") as f:
        json.dump(sorted_txs, f, indent=2)
        
    print(f"Successfully parsed {len(sorted_txs)} unique transactions.")

if __name__ == "__main__":
    main()
