import pandas as pd
import os
from pathlib import Path
import json
from datetime import datetime


class ExcelAnalyzer:
    def __init__(self, excel_dir):
        self.excel_dir = Path(excel_dir)
        
    def analyze_client_list(self, file_path):
        """Analyze client list Excel file"""
        print(f"\n=== Analyzing Client List: {file_path} ===")
        
        # Read all sheets
        excel_file = pd.ExcelFile(file_path)
        print(f"Number of sheets: {len(excel_file.sheet_names)}")
        print(f"Sheet names: {excel_file.sheet_names}")
        
        analysis_results = {}
        
        for sheet_name in excel_file.sheet_names:
            print(f"\n--- Sheet: {sheet_name} ---")
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            
            print(f"Shape: {df.shape}")
            print(f"Columns: {list(df.columns)}")
            print(f"\nColumn data types:")
            for col in df.columns:
                print(f"  {col}: {df[col].dtype}")
            
            print(f"\nFirst 5 rows:")
            print(df.head())
            
            print(f"\nNull values per column:")
            print(df.isnull().sum())
            
            analysis_results[sheet_name] = {
                'shape': df.shape,
                'columns': list(df.columns),
                'dtypes': {col: str(df[col].dtype) for col in df.columns},
                'null_counts': df.isnull().sum().to_dict(),
                'sample_data': df.head().to_dict()
            }
            
        return analysis_results
    
    def analyze_delivery_history(self, file_path):
        """Analyze delivery history Excel file"""
        print(f"\n=== Analyzing Delivery History: {file_path} ===")
        
        # Read all sheets
        excel_file = pd.ExcelFile(file_path)
        print(f"Number of sheets: {len(excel_file.sheet_names)}")
        print(f"Sheet names: {excel_file.sheet_names}")
        
        analysis_results = {}
        
        for sheet_name in excel_file.sheet_names:
            print(f"\n--- Sheet: {sheet_name} ---")
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            
            print(f"Shape: {df.shape}")
            print(f"Columns: {list(df.columns)}")
            print(f"\nColumn data types:")
            for col in df.columns:
                print(f"  {col}: {df[col].dtype}")
            
            print(f"\nFirst 5 rows:")
            print(df.head())
            
            print(f"\nNull values per column:")
            print(df.isnull().sum())
            
            # Check for date columns
            date_columns = []
            for col in df.columns:
                if 'date' in col.lower() or '日期' in col or '時間' in col:
                    date_columns.append(col)
                    print(f"\nDate column '{col}' sample values:")
                    print(df[col].head(10))
            
            analysis_results[sheet_name] = {
                'shape': df.shape,
                'columns': list(df.columns),
                'dtypes': {col: str(df[col].dtype) for col in df.columns},
                'null_counts': df.isnull().sum().to_dict(),
                'date_columns': date_columns,
                'sample_data': df.head().to_dict()
            }
            
        return analysis_results
    
    def run_analysis(self):
        """Run complete analysis on all Excel files"""
        assets_dir = self.excel_dir / "src" / "main" / "resources" / "assets"
        
        # Analyze client list
        client_file = assets_dir / "2025-05 client list.xlsx"
        if client_file.exists():
            client_analysis = self.analyze_client_list(client_file)
        else:
            print(f"Client file not found: {client_file}")
            client_analysis = {}
        
        # Analyze delivery history
        delivery_file = assets_dir / "2025-05 deliver history.xlsx"
        if delivery_file.exists():
            delivery_analysis = self.analyze_delivery_history(delivery_file)
        else:
            print(f"Delivery file not found: {delivery_file}")
            delivery_analysis = {}
        
        # Save analysis results
        results = {
            'client_list_analysis': client_analysis,
            'delivery_history_analysis': delivery_analysis
        }
        
        output_dir = self.excel_dir / "output"
        output_dir.mkdir(exist_ok=True)
        
        # Custom JSON encoder to handle datetime objects
        def default_encoder(obj):
            if isinstance(obj, datetime):
                return obj.strftime("%Y-%m-%d %H:%M:%S")
            elif hasattr(obj, 'to_dict'):
                return obj.to_dict()
            else:
                return str(obj)
        
        with open(output_dir / "excel_analysis_results.json", 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2, default=default_encoder)
        
        print(f"\n\nAnalysis results saved to: {output_dir / 'excel_analysis_results.json'}")
        
        return results


if __name__ == "__main__":
    analyzer = ExcelAnalyzer("/Users/lgee258/Desktop/LuckyGas")
    analyzer.run_analysis()