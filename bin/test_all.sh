#!/bin/bash
# ~/workspace/tekumemo/bin/test_all.sh
# 
# ⚠️ 重要: このスクリプトはDocker環境専用です ⚠️
# Docker環境でコンテナ内でテストを実行します。
# ホストマシン上で直接実行しないでください。
#
# 前提条件:
#   - Docker EngineがWSL2上で起動していること
#   - docker-compose.ymlで定義されたコンテナが起動していること
# 
# 使い方:
#   1. 実行権限を付与（初回のみ）:
#      chmod +x bin/test_all.sh
#   
#   2. スクリプトを実行:
#      ./bin/test_all.sh
#
# このスクリプトは以下を自動で実行します:
#   1. Dockerコンテナの起動確認
#   2. テストデータベースの準備
#   3. RuboCopによるコードスタイルチェック
#   4. RSpecによる全テスト実行

set -e  # エラーが発生したら即座に終了

# 終了時にファイルの所有権を修正（Dockerがrootで作ったファイルをユーザー権限に戻す）
# sudoがパスワードを要求する場合の対策として、Dockerコンテナ内からchownを実行する
cleanup() {
  if [ -n "$DOCKER_FIX_OWNERSHIP" ]; then
      echo ""
      echo "🧹 ファイルの所有権を修正中..."
      # ホストのUID:GID（通常1000:1000）に合わせて修正
      docker exec tekumemo-web chown -R $(id -u):$(id -g) . || true
  fi
}
trap cleanup EXIT
# 処理開始フラグ
DOCKER_FIX_OWNERSHIP=true

echo "========================================="
echo "  全テスト実行 (Docker環境)"
echo "========================================="
echo ""
echo "ℹ️  このスクリプトはDocker環境でのみ動作します"
echo ""

# Docker環境チェック: dockerコマンドが利用可能か確認
if ! command -v docker &> /dev/null; then
    echo "🚨 エラー: Dockerがインストールされていません"
    echo ""
    echo "このプロジェクトはDocker環境でのテスト実行が必須です。"
    echo "以下を確認してください:"
    echo "  1. Docker EngineがWSL2にインストールされているか"
    echo "  2. dockerコマンドが使用可能か"
    echo ""
    exit 1
fi

# コンテナが起動しているか確認し、起動していなければ自動起動
echo "--- Step 1/4: Dockerコンテナの状態確認 ---"
if ! docker ps | grep -q tekumemo-web; then
    echo "🔄 コンテナが起動していないため、自動起動します..."
    docker compose up -d
    
    echo "⏳ コンテナの起動を待機中..."
    # コンテナが安定するまで少し待つ
    sleep 10
else
    echo "✅ コンテナ起動済み"
fi
echo ""
# テストデータベースの準備
echo "--- Step 2/4: テストデータベース準備 ---"

# まず通常の方法でDB準備を試みる
if docker exec tekumemo-web bash -c "DATABASE_URL='postgresql://postgres:password@db:5432/tekumemo_test' RAILS_ENV=test DISABLE_DATABASE_ENVIRONMENT_CHECK=1 bundle exec rails db:test:prepare" > /dev/null 2>&1; then
    echo "✅ テストDB準備完了 (高速モード)"
else
    echo "⚠️ 通常の準備に失敗しました。詳細なリセットを実行します..."
    
    # テストDBへの既存接続を強制切断（ObjectInUseエラー回避の最終手段）
    echo "🔄 DBコンテナを再起動して接続を完全リセット中..."
    docker compose restart db
    
    # DBの起動待機（最大30秒）
    echo "⏳ DBの起動を待機中..."
    for i in {1..30}; do
      if docker exec tekumemo-db pg_isready -U postgres > /dev/null 2>&1; then
        echo "✅ DB起動完了"
        break
      fi
      sleep 1
    done

    # PostgreSQLのFORCEオプションを使って強制的にDBを削除
    echo "💣 テストDBを強制削除中..."
    docker exec tekumemo-db psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS tekumemo_test WITH (FORCE);" > /dev/null 2>&1 || true

    echo "🔄 テストDBを再作成中..."
    if docker exec tekumemo-web bash -c "DATABASE_URL='postgresql://postgres:password@db:5432/tekumemo_test' RAILS_ENV=test DISABLE_DATABASE_ENVIRONMENT_CHECK=1 bundle exec rails db:test:prepare"; then
        echo "✅ テストDB準備完了 (リカバリー成功)"
    else
        echo "🚨 テストDBの準備に失敗しました"
        exit 1
    fi
fi
echo ""
echo ""

# RuboCopの実行（自動修正）
echo "--- Step 3/4: RuboCopによるコードスタイルチェック ---"
docker exec tekumemo-web bash -c "bundle exec rubocop -a"
rubocop_exit=$?
if [ $rubocop_exit -ne 0 ]; then
    echo "⚠️ RuboCopで修正不能なスタイルエラーが検出されました"
    echo "テストは続行しますが、後で確認してください"
fi
echo ""

# RSpecの実行
echo "--- Step 4/4: RSpec実行（Docker環境内） ---"
docker exec tekumemo-web bash -c "DATABASE_URL='postgresql://postgres:password@db:5432/tekumemo_test' RAILS_ENV=test bundle exec rspec spec/ --format documentation"
rspec_exit=$?

echo ""
echo "========================================="
if [ $rspec_exit -eq 0 ]; then
    echo "✅ 全てのテストが成功しました！"
    echo "========================================="
    exit 0
else
    echo "🚨 テストが失敗しました"
    echo "========================================="
    echo ""
    echo "修正のヒント:"
    echo "  1. 上記のエラーログを確認してください"
    echo "  2. 該当のspecファイルを個別に実行して詳細を確認:"
    echo "     docker exec tekumemo-web bash -c 'RAILS_ENV=test bundle exec rspec spec/path/to/failing_spec.rb -fd'"
    echo "  3. デバッグ用にbinding.bを使用できます"
    echo ""
    echo "ℹ️  注意: テストはDocker環境内で実行されています"
    exit 1
fi
