---
name: 仕様策定 (Spec)
about: 新機能や改善の仕様を定義する際に使用 (SDD/TDD/BDD準拠)
title: '[SPEC] E05-02: DynamoDBへの投稿保存'
labels: 'spec, E05, backend'
assignees: ''
---

## 📋 概要
ユーザーから送信された投稿データ（ニックネーム、本文）を検証後、DynamoDBの `posts` テーブルに保存する機能を実装します。

## 🎯 目的
- ユーザーの投稿を永続化し、後の審査プロセス（E06）やランキング表示（E08）で利用できるようにする。
- 投稿に対して一意なID（UUID）を払い出し、クライアントに返却する基盤を作る。

---

## 📝 詳細仕様

### 機能要件
- 以下の属性を持つレコードを `posts` テーブルに作成する
  - `id`: UUID v4（自動生成）
  - `nickname`: 入力値
  - `body`: 入力値
  - `status`: 初期値 `"judging"`
  - `judges_count`: 初期値 `0`
  - `created_at`: 現在のUnixタイムスタンプ（整数）
  - `average_score`: 未設定（`nil`）
  - `score_key`: 未設定（`nil`）

### 非機能要件
- DynamoDBへの保存は同期的に行う（重要度が高いため）
- 読み書きのエラーハンドリングを行う

### UI/UX設計
- 直接的なUI変更はないが、保存成功後にクライアントへ `id` と `status` を返すための準備となる。

---

## 🔧 技術仕様

### データモデル (DynamoDB)
`app/models/post.rb` (Dynamoidを使用)

| 項目 | 値 | 備考 |
|------|-----|------|
| Table | `posts` | |
| PK | `id` | String (UUID) |
| Attributes | `nickname` | String |
| | `body` | String |
| | `status` | String (Default: "judging") |
| | `judges_count` | Integer (Default: 0) |
| | `created_at` | Integer (Unix Timestamp) |
| | `average_score` | Number (Nullable) |
| | `score_key` | String (Nullable) |

### API設計
本タスクはModel層の実装が主だが、Controllerからの呼び出しも想定する。

- **Class**: `Post`
- **Method**: `save` (Dynamoid標準)

---

## 🧪 テスト計画 (TDD)

### Unit Test (Model)
`spec/models/post_spec.rb`

- [ ] **正常系**:
  - `nickname`と`body`を指定して保存できること
  - 保存時に `id` (UUID) が自動生成されること
  - 保存時に `status` がデフォルトで `"judging"` になること
  - 保存時に `judges_count` がデフォルトで `0` になること
  - 保存時に `created_at` が設定されること
- [ ] **異常系**:
  - 必須項目（nickname, body）欠損時に保存できないこと（バリデーションはE05-01で実装済みだが、保存前にも確認）

### Request Spec (API)
`spec/requests/api/posts_spec.rb`

- [ ] `POST /api/posts`:
  - 有効なパラメータ送信時、DBにレコードが1件増えること
  - 保存されたレコードの内容が送信内容と一致すること

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)
- [ ] **Given** 有効なニックネームと本文がある
      **When** `Post.create` を呼び出す
      **Then** DynamoDBにレコードが保存され、`id`がUUID形式で、`status`が"judging"であること

### 異常系 (Error Path)
- [ ] **Given** DynamoDBがダウンしている（モックで再現）
      **When** 保存を試みる
      **Then** 適切なエラー（500 Internal Server Error相当）が発生すること

---

## 🔗 関連資料
- `docs/db_schema.md`: テーブル定義
- `docs/epics.md`: E05概要

---

**レビュアーへの確認事項:**
- [ ] 初期ステータスやデフォルト値の設計は正しいか
- [ ] タイムスタンプの形式（Unix Time）は整合しているか
