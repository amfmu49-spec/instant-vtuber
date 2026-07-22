import os
import time
import shutil
import glob

# 設定
DRIVE_BASE_DIR = 'G:\\マイドライブ\\VTuber_Pipeline'
OUTPUT_DIR = os.path.join(DRIVE_BASE_DIR, 'output')
LOCAL_DEPLOY_DIR = 'C:\\Users\\evoli\\OneDrive\\Desktop\\VTuber_Assets'  # デスクトップの素材フォルダ

def main():
    print(f"[Antigravity Pipeline Agent] Started")
    print(f"Watch Dir: {OUTPUT_DIR}")
    print(f"Deploy Dir: {LOCAL_DEPLOY_DIR}")
    
    if not os.path.exists(LOCAL_DEPLOY_DIR):
        os.makedirs(LOCAL_DEPLOY_DIR, exist_ok=True)
        
    processed_files = set()
    
    while True:
        if os.path.exists(OUTPUT_DIR):
            psd_files = glob.glob(os.path.join(OUTPUT_DIR, '*.psd'))
            
            for psd_path in psd_files:
                filename = os.path.basename(psd_path)
                if filename not in processed_files:
                    deploy_path = os.path.join(LOCAL_DEPLOY_DIR, filename)
                    
                    try:
                        # 少し待機してファイルの書き込み完了を待つ
                        time.sleep(2)
                        shutil.copy2(psd_path, deploy_path)
                        print(f"[Success] Auto deployed new asset: {deploy_path}")
                        processed_files.add(filename)
                    except Exception as e:
                        print(f"[Error] Failed to deploy: {e}")
                        
        time.sleep(3)

if __name__ == '__main__':
    main()
