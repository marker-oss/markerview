package marketplace

import (
	"context"
	"time"
)

type Review struct {
	Marketplace       string
	ExternalReviewID  string
	ExternalProductID string
	SellerArticle     string
	Rating            *int
	Title             string
	AuthorName        string
	Text              string
	Pros              string
	Cons              string
	CreatedAtMP       time.Time
	UpdatedAtMP       *time.Time
	Answer            *Answer
	Media             []Media
	ProductName       string // raw product title from the marketplace payload
	ProductPrice      string // raw price string from the marketplace payload, e.g. "1 799 ₽"
	// Recommend is the marketplace per-review "recommended" flag (YM). Used
	// only for aggregate recommendPercent; zero value = unknown/absent.
	Recommend bool
	Raw       []byte
}

type Media struct {
	Kind       string
	URL        string
	PreviewURL string
	Position   int
	Likes      int
	Duration   float64
}

type Answer struct {
	Text  string
	State string
}

type Adapter interface {
	Marketplace() string
	FetchReviews(ctx context.Context, since time.Time, cursor string) ([]Review, string, error)
}

// ReplyPublisher is implemented by adapters that can publish a seller reply
// back to the marketplace. Adapters that cannot (or for accounts lacking
// access) simply do not implement it; callers treat that as "unsupported".
type ReplyPublisher interface {
	PublishReply(ctx context.Context, externalReviewID, text string) error
}

// ArticleMapper is implemented by adapters that can enumerate the seller's
// marketplace catalog and report which seller article (offer id / vendor
// code) each external product id belongs to. The collector uses it to heal
// reviews stored before the mapping was available.
type ArticleMapper interface {
	ProductArticles(ctx context.Context) (map[string]string, error)
}

// Question is a product question fetched from a marketplace.
type Question struct {
	ExternalQuestionID string
	ExternalProductID  string
	SellerArticle      string
	ExternalSKU        string // Ozon needs numeric SKU to answer; WB leaves this empty
	AuthorName         string
	Text               string
	Answer             *Answer
	CreatedAtMP        time.Time
}

// QuestionFetcher is implemented by adapters that can fetch unanswered product
// questions from the marketplace.
type QuestionFetcher interface {
	FetchQuestions(ctx context.Context, since time.Time, cursor string) ([]Question, string, error)
}

// QuestionAnswerPublisher is implemented by adapters that can publish a seller
// answer to a product question back to the marketplace. Adapters that cannot
// simply do not implement it; callers treat that as "unsupported".
type QuestionAnswerPublisher interface {
	PublishQuestionAnswer(ctx context.Context, externalQuestionID, sku, text string) error
}
