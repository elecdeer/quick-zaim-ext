import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";

using TypeSpec.Http;

@route("/home/money")
namespace ZaimAPI.Money {
  model Money {
    /** Unique input id */
    id: int32;

    /** Type of transaction: income, payment, or transfer */
    mode: "income" | "payment" | "transfer";

    /** User ID */
    user_id: int32;

    /** Date of the transaction in YYYY-MM-DD format */
    date: string;

    /** Category ID */
    category_id: int32;

    /** Genre ID */
    genre_id: int32;

    /** Account ID for incoming transfer (for income or transfer) */
    to_account_id: int32;

    /** Account ID for outgoing transfer (for payment or transfer) */
    from_account_id: int32;

    /** Amount without decimal point */
    amount: int32;

    /** Comment or memo */
    comment: string;

    /** Active status */
    active: int32;

    /** Name of the item or product */
    name: string;

    /** Receipt ID */
    receipt_id: int32;

    /** Place name */
    place: string;

    /** Creation timestamp */
    created: string;

    /** Currency code */
    currency_code: string;
  }

  @route("/")
  @get
  op getMoney(
    /** Required. Set to 1 */
    @query mapping: 1,

    /** Filter by category ID */
    @query category_id?: int32,

    /** Filter by genre ID */
    @query genre_id?: int32,

    /** Filter by transaction type */
    @query mode?: "payment" | "income" | "transfer",

    /** Sort by id or date (default: date) */
    @query order?: "id" | "date",

    /** Start date in Y-m-d format */
    @query start_date?: string,

    /** End date in Y-m-d format */
    @query end_date?: string,

    /** Page number (default: 1) */
    @query page?: int32,

    /** Number of items per page (default: 20, max: 100) */
    @query limit?: int32,

    /** Group results by receipt_id */
    @query group_by?: "receipt_id",
  ): SuccessResponse<{
    /** List of money transactions */
    money: Money[];
  }> | ErrorResponse;

  model MoneyResponse {
    money: {
      /** Unique ID given by Zaim for each input */
      id: int32;

      /** Modification timestamp */
      modified: string;

      /** Place UID (only present if a place was specified) */
      place_uid?: string;
    };

    /** Place information (only present if a place was specified) */
    place?: {
      id: int32;
      user_id: int32;
      genre_id: int32;
      category_id: int32;
      account_id: int32;
      transfer_account_id: int32;
      mode: string;
      place_uid: string;
      service: string;
      name: string;
      original_name: string;
      tel: string;
      count: int32;
      place_pattern_id: int32;
      calc_flag: int32;
      edit_flag: int32;
      active: int32;
      modified: string;
      created: string;
    };

    user: {
      /** Number of consecutive days of recording */
      repeat_count: int32;

      /** Total number of days with records */
      day_count: int32;

      /** Total number of inputs by the user */
      input_count: int32;
    };
  }

  model PaymentData {
    /** Required. Set to 1 */
    @query mapping: 1;

    /** Category ID for payment */
    @query category_id: int32;

    /** Genre ID for payment */
    @query genre_id: int32;

    /** Amount without decimal point */
    @query amount: int32;

    /** Date in Y-m-d format (past/future 5 years is valid) */
    @query date: string;

    /** Account ID for payment */
    @query from_account_id?: int32;

    /** Comment (within 100 characters) */
    @query comment?: string;

    /** Product name (within 100 characters) */
    @query name?: string;

    /** Place name (within 100 characters) */
    @query place?: string;
  }

  @route("/payment")
  interface PaymentOperations {
    @post
    create(...PaymentData): SuccessResponse<MoneyResponse> | ErrorResponse;

    @put
    update(
      @path id: int32,
      ...PaymentData,
    ): SuccessResponse<MoneyResponse> | ErrorResponse;

    @delete
    delete(@path id: int32): SuccessResponse<MoneyResponse> | ErrorResponse;
  }

  model IncomeData {
    /** Required. Set to 1 */
    @query mapping: 1;

    /** Category ID for income */
    @query category_id: int32;

    /** Amount without decimal point */
    @query amount: int32;

    /** Date in Y-m-d format (past three months) */
    @query date: string;

    /** Account ID for income */
    @query to_account_id?: int32;

    /** Place name (within 100 characters) */
    @query place?: string;

    /** Comment (within 100 characters) */
    @query comment?: string;
  }

  @route("/income")
  interface IncomeOperations {
    @post
    create(...IncomeData): SuccessResponse<MoneyResponse> | ErrorResponse;

    @put
    update(
      @path id: int32,
      ...IncomeData,
    ): SuccessResponse<MoneyResponse> | ErrorResponse;

    @delete
    delete(@path id: int32): SuccessResponse<MoneyResponse> | ErrorResponse;
  }

  model TransferData {
    /** Required. Set to 1 */
    @query mapping: 1;

    /** Amount without decimal point */
    @query amount: int32;

    /** Date in Y-m-d format (past/future 5 years is valid) */
    @query date: string;

    /** Account ID for transfer from */
    @query from_account_id: int32;

    /** Account ID for transfer to */
    @query to_account_id: int32;

    /** Comment (within 100 characters) */
    @query comment?: string;
  }

  @route("/transfer")
  interface TransferOperations {
    @post
    create(...TransferData): SuccessResponse<MoneyResponse> | ErrorResponse;

    @put
    update(
      @path id: int32,
      ...TransferData,
    ): SuccessResponse<MoneyResponse> | ErrorResponse;

    @delete
    delete(@path id: int32): SuccessResponse<MoneyResponse> | ErrorResponse;
  }
}
