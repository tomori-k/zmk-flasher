### 1. 画面（ビュー）の一覧

| ID      | 画面名                         | 役割                                                           |
| ------- | ------------------------------ | -------------------------------------------------------------- |
| **A**   | メインウィンドウ               | アプリ本体。上部にタブバーを持ち、**B** と **C** を切り替える  |
| **B**   | ファームウェア書き込みタブ     | キーボードを選び、対応ファームを書き込むための一連の操作ビュー |
| **B-1** | 追加リポジトリダイアログ       | GitHub リポジトリと PAT を登録するためのモーダル               |
| **C**   | Keymap Editor タブ             | Web 上の Keymap Editor を表示（埋め込み or 外部ブラウザ起動）  |
| **D**   | 進捗ポップオーバー／ダイアログ | Flash 中のプログレスと結果を表示（B 内から呼び出し）           |

---

### 2. 各画面に含まれる主な項目

#### **A. メインウィンドウ**

- **タブバー**

  - _「ファームウェア書き込み」_（選択で **B**）
  - _「Keymap Editor」_（選択で **C**）

---

#### **B. ファームウェア書き込みタブ**

| セクション                 | 主な項目                                                                                        | 備考                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **① 接続キーボード**       | - デバイス一覧 (名称 / 片側識別 / PID-VID)<br>- 手動リフレッシュ操作                            | _選択必須_                                    |
| **② ファームウェアソース** | - 登録済みリポジトリ一覧<br>- **「＋リポジトリ追加」ボタン**                                    | _リポジトリ未登録なら空状態_                  |
| **③ ファームウェア一覧**   | - 選択デバイス × 選択リポジトリに合致する `.uf2` 一覧<br>- 各ファームのビルド日時・ブランチ表示 | _デバイス & リポジトリが決まったら自動ロード_ |
| **④ 詳細／互換チェック**   | - 選択ファームの BoardID / familyID / サイズ<br>- 選択デバイスとの互換結果 (OK/NG)              | NG 時は書き込み不可表示                       |
| **⑤ 書き込み操作**         | - _「Flash!」_ ボタン（有効化は互換 OK 時）<br>- クリックで **D** を呼び出す                    |                                               |

---

#### **B-1. 追加リポジトリダイアログ**

- GitHub URL / owner + repo 入力
- PAT 入力 & 保存オプション
- _追加_ / _キャンセル_ ボタン

> 成功時：ダイアログを閉じ、**②** のリポジトリ一覧に即反映

---

#### **C. Keymap Editor タブ**

- Keymap Editor 本体（iframe 埋め込み、または「開く」ボタンで外部ブラウザ）
- （オプション）選択リポジトリのブランチや `keymap.json` をクエリに付与

---

#### **D. 進捗ポップオーバー／ダイアログ**

- プログレスバー（% またはコピー済みバイト）
- ログテキスト（省略可）
- 成功時：_完了_ ボタン → **B** の状態を更新
- 失敗時：_リトライ_ と _閉じる_ ボタン

---

### 3. 画面間遷移フロー（概要）

```text
起動 ─► A (タブバー表示)
        │
        ├─ デフォルトで B を表示
        │     │
        │     ├─ ① でデバイス選択
        │     │
        │     ├─ 「＋リポジトリ追加」→ B-1 → 完了時 ② 更新
        │     │
        │     ├─ ② でリポジトリ選択
        │     │      └─ ③ 自動ロード
        │     │
        │     ├─ ③ でファーム選択
        │     │      └─ ④ に詳細反映
        │     │
        │     └─ ⑤ Flash! → D
        │            ├─ 成功 → D終了 → B (状態: “書き込み済”) へ戻る
        │            └─ 失敗 → D内でリトライ or B へ戻る
        │
        └─ タブ切替
              ├─ B を選択 ⇒ ファーム書き込みタブへ
              └─ C を選択 ⇒ Keymap Editor タブへ
```

_どの画面からでも_ タブバーで **B** と **C** は即時切替可能。
モーダル **B-1** と **D** は親タブ (**B**) の上に重ねて開き、終了時に元の状態へ復帰します。
