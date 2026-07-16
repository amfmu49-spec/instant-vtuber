import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AvatarCoords } from '../store/AppContext';

export const analyzeAvatarImage = async (apiKey: string, base64Image: string): Promise<AvatarCoords | null> => {
  if (!apiKey || !base64Image) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Base64からヘッダー（data:image/png;base64,）を取り除く
    const base64Data = base64Image.split(',')[1];
    const mimeType = base64Image.split(';')[0].split(':')[1] || 'image/jpeg';

    const partsLibraryRes = await fetch('/parts/library.json');
    const partsLibrary = await partsLibraryRes.json();

    const prompt = `
この画像を解析し、キャラクターの顔のパーツの位置（バウンディングボックス）と状態、および最適なストックパーツをJSONで返してください。
画像の左上を(0, 0)、右下を(1, 1)とする相対座標（0.0〜1.0）で答えてください。

【ストックパーツ選択の指示】
提供された以下のストックパーツのリスト（JSON形式）から、このキャラクターの画風、目の形、雰囲気に最も似合う「目のID」と「口のID」を選んでください。
また、パーツを馴染ませるために「肌のベース色（skinColorHex）」と「まつげ/線の色（lashColorHex）」を画像から抽出してください。

[ストックパーツリスト]
${JSON.stringify(partsLibrary, null, 2)}

必ず以下のJSON形式のみを出力してください。
{
  "leftEye": { "x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0 },
  "rightEye": { "x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0 },
  "mouth": { "x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0 },
  "mouthState": "open",
  "eyeState": "open",
  "selectedEyeId": "eye_anime_tsuri",
  "selectedMouthId": "mouth_anime_smile_open",
  "skinColorHex": "#ffcccc",
  "lashColorHex": "#222222"
}
    `;

    // ユーザーのAPIキーを使って、実際に利用可能なモデルのリストをGoogle APIから取得する
    let modelsToTry: string[] = [];
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (res.ok) {
        const json = await res.json();
        if (json.models && Array.isArray(json.models)) {
          // generateContentをサポートしているモデルを抽出
          const validModels = json.models.filter((m: any) => 
            m.supportedGenerationMethods?.includes("generateContent") && 
            m.name.includes("gemini")
          );
          
          // 最新バージョン順にソート (gemini-2.0 -> gemini-1.5)
          validModels.sort((a, b) => b.name.localeCompare(a.name));
          
          modelsToTry = validModels.map((m: any) => m.name.replace("models/", ""));
          console.log("Dynamically loaded models:", modelsToTry);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch dynamic model list:", e);
    }

    // 動的取得に失敗した場合やリストが空の場合のフォールバック
    if (modelsToTry.length === 0) {
      modelsToTry = [
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-1.0-pro-vision"
      ];
    }

    let result = null;
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        // responseMimeTypeの指定は古いモデルでエラーになる可能性があるため削除し、プロンプトの指示と後処理で担保する
        const model = genAI.getGenerativeModel({ model: modelName });
        
        const response = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          }
        ]);
        
        result = response;
        console.log(`Successfully used Gemini model: ${modelName}`);
        break; // 成功したらループを抜ける
      } catch (e: any) {
        console.warn(`Model ${modelName} failed:`, e.message);
        lastError = e;
        // 次のモデルを試す
      }
    }

    if (!result) {
      throw lastError || new Error("利用可能なGeminiモデルが見つかりませんでした。");
    }

    let text = result.response.text();
    // レスポンスにマークダウンの ```json が含まれている場合を取り除く
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    try {
      const data = JSON.parse(text);
      return data as AvatarCoords;
    } catch (parseError) {
      console.error("Failed to parse JSON:", text);
      throw new Error("解析結果の読み取りに失敗しました。もう一度お試しください。");
    }

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "画像の解析中に予期せぬエラーが発生しました");
  }
};
