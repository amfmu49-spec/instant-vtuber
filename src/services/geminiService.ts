import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AvatarCoords } from '../store/AppContext';
import { generateProceduralAssetSheetDataUrl } from '../utils/proceduralAssetSheet';

export const analyzeAvatarImage = async (apiKey: string, base64Image: string): Promise<AvatarCoords | null> => {
  if (!apiKey || !base64Image) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Base64からヘッダー（data:image/png;base64,）を取り除く
    const base64Data = base64Image.split(',')[1];
    const mimeType = base64Image.split(';')[0].split(':')[1] || 'image/jpeg';

    const partsLibraryRes = await fetch(`${import.meta.env.BASE_URL}parts/library.json`);
    const partsLibrary = await partsLibraryRes.json();

    const prompt = `
この画像を解析し、キャラクターの顔のパーツの位置（バウンディングボックス）と状態をJSONで返してください。
画像の左上を(0, 0)、右下を(1, 1)とする相対座標（0.0〜1.0）で答えてください。
パーツを馴染ませるために「肌のベース色（skinColorHex）」と「まつげ/線の色（lashColorHex）」を画像から抽出してください。

必ず以下のJSON形式のみを出力してください。初期状態ではパーツ選択は行わず（空文字）、元の画像の切り抜きを使用します。
{
  "leftEye": { "x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0 },
  "rightEye": { "x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0 },
  "mouth": { "x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0 },
  "mouthState": "open",
  "eyeState": "open",
  "selectedEyeId": "",
  "selectedMouthId": "",
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

export const getAvailableImagenModel = async (apiKey: string): Promise<string> => {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (res.ok) {
      const json = await res.json();
      if (json.models && Array.isArray(json.models)) {
        // "imagen" を名前に含み、かつ "predict" がサポートされているモデルを検索
        const imagenModels = json.models.filter((m: any) => 
          m.name.toLowerCase().includes("imagen") && 
          m.supportedGenerationMethods?.includes("predict")
        );
        if (imagenModels.length > 0) {
          const modelName = imagenModels[0].name.replace("models/", "");
          console.log("Dynamically found active Imagen model:", modelName);
          return modelName;
        }
      }
    }
  } catch (e) {
    console.warn("Failed to fetch dynamic Imagen model list:", e);
  }
  // 利用可能なモデルが見つからなかった場合のデフォルトフォールバック
  return "imagen-3.0-generate-002";
};

export const generateCharacterImage = async (apiKey: string, promptText: string): Promise<string> => {
  if (!apiKey || !promptText) throw new Error("APIキーまたはプロンプトが空です。");

  // 利用可能なImagenモデル名を動的に取得
  const modelName = await getAvailableImagenModel(apiKey);
  console.log(`Using Imagen model endpoint: ${modelName}`);

  // 切り抜きやすさとアバターとしての見栄えを保証するプロンプトテンプレート
  const fullPrompt = `${promptText}, front-facing bust-up portrait, looking at the viewer. Clear neck line without any accessories, simple hairstyle. Solid flat white background, digital anime style.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        instances: [
          {
            prompt: fullPrompt
          }
        ],
        parameters: {
          sampleCount: 1,
          outputMimeType: "image/png",
          aspectRatio: "1:1"
        }
      })
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const errMsg = errJson.error?.message || `HTTP ${response.status} エラー`;
      throw new Error(errMsg);
    }

    const result = await response.json();
    const base64Bytes = result.predictions?.[0]?.bytesBase64Encoded;
    if (!base64Bytes) {
      throw new Error("画像データの取得に失敗しました。レスポンスが空です。");
    }

    return `data:image/png;base64,${base64Bytes}`;
  } catch (error: any) {
    console.error("Imagen API Error:", error);
    throw new Error(error.message || "画像の生成中にエラーが発生しました。");
  }
};

export const generateVTuberAssetSheetPrompt = (customDetails: string): string => {
  const details = customDetails.trim() ? customDetails : "cute anime girl with silver hair, twin tails, blue eyes, wearing stylish sailor uniform";
  return `A high-resolution VTuber asset sheet designed for Live2D animation, in a clean 16:9 layout on a transparent or plain white background.

The canvas is divided vertically into two halves:

LEFT HALF:
A front-facing anime-style character bust (from chest up), with full hair, head, and body details, but with a completely blank face (no eyes, no mouth, no eyebrows). The face area is smooth and clean, designed as a base layer for facial parts.

RIGHT HALF:
Organized expression parts for the same character, neatly arranged and clearly separated:
- Both eyes open (neutral expression)
- Both eyes closed
- Mouth open
- Mouth neutral (closed, straight line)

All parts must match perfectly in style, size, and alignment with the base face on the left.
Use crisp anime-style linework, soft shading, and consistent lighting.

The character should have a modern VTuber aesthetic (clean, appealing, slightly stylized, suitable for streaming avatar use).

Ensure precise alignment and spacing for easy rigging in Live2D.

Character Design Details: ${details}`;
};

export const generateVTuberAssetSheet = async (
  apiKey: string,
  userPrompt: string,
  useFreeMode: boolean = false
): Promise<string> => {
  const fullPrompt = generateVTuberAssetSheetPrompt(userPrompt);

  if (useFreeMode || !apiKey.trim()) {
    return generateFree16by9AssetSheet(fullPrompt);
  }

  // 利用可能なImagen 3モデル名を動的に取得
  const modelName = await getAvailableImagenModel(apiKey.trim());
  console.log(`Executing Google Imagen 3 API call with endpoint: ${modelName}`);

  // トライするImagenモデルのエンドポイントリスト
  const imagenModelsToTry = [
    modelName,
    "imagen-3.0-generate-002",
    "imagen-3.0-generate-001",
    "imagen-3.0-fast-generate-001"
  ];

  // 重複を除去
  const uniqueModels = Array.from(new Set(imagenModelsToTry));
  let lastErrorMsg = "";

  for (const model of uniqueModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey.trim()}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          instances: [
            {
              prompt: fullPrompt
            }
          ],
          parameters: {
            sampleCount: 1,
            outputMimeType: "image/png",
            aspectRatio: "16:9"
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        const base64Bytes = result.predictions?.[0]?.bytesBase64Encoded;
        if (base64Bytes) {
          console.log(`Successfully generated 16:9 VTuber Asset Sheet with Google Imagen 3 (${model})`);
          return `data:image/png;base64,${base64Bytes}`;
        }
      } else {
        const errJson = await response.json().catch(() => ({}));
        lastErrorMsg = errJson.error?.message || `HTTP ${response.status} エラー (${model})`;
        console.warn(`Imagen API model ${model} failed:`, lastErrorMsg);
      }
    } catch (e: any) {
      lastErrorMsg = e.message || "ネットワーク通信エラー";
      console.warn(`Imagen API fetch exception for ${model}:`, e);
    }
  }

  // APIキーモードで明示的にGoogle APIからエラーが返ってきた場合
  console.warn("All Google Imagen 3 API calls failed:", lastErrorMsg);
  
  // 無料モードへフォールバックしてユーザーの体験を保護
  try {
    console.log("Attempting fallback to Free AI generator...");
    return await generateFree16by9AssetSheet(fullPrompt);
  } catch (fallbackError: any) {
    throw new Error(`Google Gemini API エラー: ${lastErrorMsg}\n(入力したAPIキーが有効か、Google AI StudioでImagen APIが有効化されているかご確認ください。)`);
  }
};

export const generateFree16by9AssetSheet = async (customPrompt: string): Promise<string> => {
  // Pollinations 用にプロンプトをワンライン化＆最適化
  const cleanPrompt = customPrompt
    .replace(/\s+/g, ' ')
    .trim();
  
  const shortPrompt = cleanPrompt.length > 300
    ? `16:9 VTuber asset sheet, left half blank face anime bust, right half 4 expression parts (eyes open, eyes closed, mouth open, mouth neutral), ${customPrompt.slice(0, 120)}`
    : cleanPrompt;

  const encodedPrompt = encodeURIComponent(shortPrompt);
  const seed = Math.floor(Math.random() * 1000000);

  // フォールバックモデルリスト (flux-anime -> flux -> turbo)
  const models = ['flux-anime', 'flux', 'turbo'];
  
  for (const model of models) {
    try {
      console.log(`Trying Pollinations model: ${model}`);
      const url = `https://image.pollinations.ai/p/${encodedPrompt}?width=1280&height=720&seed=${seed}&nologo=true&enhance=true&model=${model}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒短縮タイムアウト

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const blob = await response.blob();
        if (blob && blob.size > 1000) {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("画像の変換に失敗しました。"));
            reader.readAsDataURL(blob);
          });
        }
      }
    } catch (e) {
      console.warn(`Pollinations model ${model} failed, trying next...`, e);
    }
  }

  // フリーサーバーが混雑・制限中の場合は、リアルタイム・プロシージャルAIキャンバス合成エンジンで100%確定生成！
  console.log("Free AI servers busy, generating instant customized procedural 16:9 VTuber asset sheet...");
  return generateProceduralAssetSheetDataUrl(customPrompt);
};


export const generateFreeCharacterImage = async (promptText: string): Promise<string> => {
  if (!promptText) throw new Error("プロンプトが空です。");

  // 日本のアニメ調2Dイラスト（セル画風）を強制する高精度プロンプト
  const fullPrompt = `${promptText}, cute japanese 2d anime illustration style, beautiful anime face, cell-shaded, flat colors, front-facing bust-up portrait, looking at the viewer. Clear neck line without any accessories, simple hairstyle. Solid flat white background.`;

  try {
    const encodedPrompt = encodeURIComponent(fullPrompt);
    const seed = Math.floor(Math.random() * 1000000);
    // model=flux-anime を指定して日本風アニメ画質を保証する
    const url = `https://image.pollinations.ai/p/${encodedPrompt}?width=512&height=512&seed=${seed}&nologo=true&enhance=true&model=flux-anime`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`画像生成サービスエラー (HTTP ${response.status})`);
    }

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
      reader.readAsDataURL(blob);
    });
  } catch (error: any) {
    console.error("Free Image Gen Error:", error);
    throw new Error(error.message || "画像の生成中にエラーが発生しました。");
  }
};

