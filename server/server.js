import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import OpenAI from "openai";
import axios from 'axios';
import https from 'https'
import * as speechToText from 'speech-to-text';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const openai = new OpenAI({ apiKey:process.env.OPENAI_API_KEY});

const app = express();

// Set up middleware
app.use(cors());
app.use(express.json()); // Use express.json() for request body parsing

function excludeAttributes(jsonObj, attributesToExclude) {
  if (typeof jsonObj !== 'object' || !Array.isArray(attributesToExclude)) {
    return jsonObj;
  }

  for (const attr of attributesToExclude) {
  if (jsonObj.hasOwnProperty("v_article_name")) {
        const aArtVal = jsonObj.v_article_name;
        if (JSON.stringify(aArtVal).includes("jpg")){
        } else {
            jsonObj.v_article_name=jsonObj.v_article_name+":"+jsonObj.v_fashion_image_base_url[0];
            console.error('jsonObj.v_article_name: '+jsonObj.v_article_name);
        }
      }
//jsonObj.productSuggestions[0].products[0].variants[0].attributes.v_fashion_image_base_url[0]
    if (jsonObj.hasOwnProperty(attr)) {
      delete jsonObj[attr];
    }
  }

  for (const key in jsonObj) {
    if (typeof jsonObj[key] === 'object') {
      excludeAttributes(jsonObj[key], attributesToExclude);
    }
  }

  return jsonObj;
}


// Chat history stored in memory
const chatHistory = [];
async function addToCart(productId, quantity) {
  console.log("#################### AD PRODUCT  TOO CAART "+productId,quantity)
  try {
    const url = 'https://localhost:9002/occ/v2/electronics/users/anonymous/carts/22a7f000-2aa2-4f78-aa3f-2503eb98a687/entries';
    const data = {
      product: {
        code: productId,
      },
      quantity: quantity,
    };

    const response = await axios.post(url, data,{ httpsAgent: new https.Agent({ rejectUnauthorized: false }) });

    if (response.status === 200) {
      console.log('Product added to the cart successfully.');
      return response.data;
    } else {
      console.error('Failed to add the product to the cart:', response.status, response.statusText);
      return null;
    }
  } catch (error) {
    console.error('An error occurred while adding the product to the cart:', error);
    return null;
  }
}


async function updateCartEntryQuantity(entryNum, newQuantity) {
  try {
    const url = `https://localhost:9002/occ/v2/electronics/users/anonymous/carts/22a7f000-2aa2-4f78-aa3f-2503eb98a687/entries/${entryNum}?fields=DEFAULT`;

    const data = {
      quantity: newQuantity,
    };

    const response = await axios.put(url, data, {
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 200) {
      console.log('Cart entry quantity updated successfully.');
      return response.data;
    } else {
      console.error('Failed to update cart entry quantity:', response.status, response.statusText);
      return null;
    }
  } catch (error) {
    console.error('An error occurred while updating cart entry quantity:', error);
    return null;
  }
}

async function getAppliedVouchers(baseSiteId, userId, cartId) {
   baseSiteId = 'electronics';
   userId = 'anonymous';
   cartId = '22a7f000-2aa2-4f78-aa3f-2503eb98a687';
  try {
    const url = `https://localhost:9002/occ/v2/${baseSiteId}/users/${userId}/carts/${cartId}/vouchers`;

    const response = await axios.get(url, {
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      headers: {
        'accept': 'application/json',
      },
    });

    if (response.status === 200) {
      console.log('Successfully retrieved applied vouchers.');
      return response.data;
    } else {
      console.error('Failed to retrieve applied vouchers:', response.status, response.statusText);
      return null;
    }
  } catch (error) {
    console.error('An error occurred while retrieving applied vouchers:', error);
    return null;
  }
}


async function getCart(cartUID) {
  console.log("#################### Get Cart "+cartUID)
  try {
    const url = 'https://localhost:9002/occ/v2/electronics/users/anonymous/carts/22a7f000-2aa2-4f78-aa3f-2503eb98a687';
  

    const response = await axios.get(url,{ httpsAgent: new https.Agent({ rejectUnauthorized: false }) });

    if (response.status === 200) {
      console.log('get the cart successfully.');
      return response.data;
    } else {
      console.error('Failed to get the cart:', response.status, response.statusText);
      return null;
    }
  } catch (error) {
    console.error('Failed to get the cart:', error);
    return null;
  }
}
async function deleteCartEntry(entryNum) {
  try {
    const url = `https://localhost:9002/occ/v2/electronics/users/anonymous/carts/22a7f000-2aa2-4f78-aa3f-2503eb98a687/entries/${entryNum}`;
  
    const response = await axios.delete(url, {
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });

    if (response.status === 200) {
      console.log('The cart entry has been deleted successfully.');
      return 'The cart entry has been deleted successfully.';
    } else {
      console.error('Failed to delete the cart entry:', response.status, response.statusText);
      return null;
    }
  } catch (error) {
    console.error('Failed to delete the cart entry:', error);
    return null;
  }
}


async function searchProductsInHM(query) {
  try {

    const url = `https://wc071439b.api.esales.apptus.cloud/api/v2/panels/slp?esales.sessionKey=af8716a7-b9af-4cbe-b94a-7a7576c0915b&esales.customerKey=af8716a7-b9af-4cbe-b94a-7a7576c0915b&esales.market=SE&market_locale=sv_se&search_prefix=${query}&search_phrase=${query}`;

    const response = await axios.get(url);

    if (response.status === 200) {
      if (typeof response.data !== 'undefined') {
       const attributesToExclude = ['autocomplete','all_categories_codes', 'category_path','folder_rankings','v_available_size_options','nonProductSuggestions','autocomplete','v_gallery_images','v_size_filters','v_available_in_store','v_article_type','v_fashion_image','v_article_order','v_composition_types','topSearches','didYouMean','v_available_size_codes','v_available_size_rate','v_categories_names','v_color_code','v_color_filter','v_fashion_image','ticket','v_material_name','v_size_filters','v_still_life_image','v_turnToSku','v_yellowprice','v_has_blueprice','v_colour_description','v_color_filter','v_color_code','v_available_size_rate','v_stylewith','v_currentlyForSaleOnSite','v_formatted_blueprice','v_formatted_yellowprice','v_has_yellowprice','v_is_old_sale','v_imagesID_lis','v_hybris_color_code','v_is_preshoppin','v_member_label','v_percentageDiscount','v_stylewith','v_sust_composition_materials','all_article_images','department_categories_codes','main_category_code','presentation_product_types','product_pk'];
       const modifiedJson = excludeAttributes(response.data, attributesToExclude);
       console.error('RESPONSE: '+JSON.stringify(response.data.productSuggestions[0].products[0].variants[0].attributes.v_fashion_image_base_url[0]));
       //console.error('Request: '+query);
       console.error('Data: '+query);
       //modifiedJson.prompt("https://image.hm.com/assets/hm/cd/2d/cd2d99b096b5386881d7ac895c1f2f4eaadacec7.jpg");
       //console.error(' modifiedJson response from Aptus Search Engine :'+JSON.stringify(modifiedJson));
        return modifiedJson;
      
      } else {
        console.error('Received an empty response from Aptus Search Engine');
        return null;
      }
    } else {
      console.error('Received an error response from Aptus Search Engine:', response.status, response.statusText);
      return null;
    }
  } catch (error) {
    console.error('An error occurred:', error);
    return null;
  }

}
async function searchProductsInElectronics(query) {
  try {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const url = `https://localhost:9002/occ/v2/electronics/products/search?currentPage=0&fields=BASIC&pageSize=10&query=${query}`;

    const response = await axios.get(url, { httpsAgent: agent });

    if (response.status === 200) {
      if (typeof response.data !== 'undefined') {
        console.info('Received  response from SOLR Search Engine' +JSON.stringify(response.data) );
        return JSON.stringify(response.data);
      
      } else {
        console.error('Received an empty response from SOLR Search Engine');
        return null;
      }
    } else {
      console.error('Received an error response from SOLR Search Engine:', response.status, response.statusText);
      return null;
    }
  } catch (error) {
    console.error('An error occurred:', error);
    return null;
  }

}

// Function to convert speech to text using the speech-to-text library
async function convertSpeechToText(audioBuffer) {
  return new Promise((resolve, reject) => {
    speechToText.recognize(
      {
        audio: {
          content: audioBuffer.toString('base64'),
        },
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: 'en-US',
        },
      },
      (err, response) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      }
    );
  });
}

async function runGPTConversation(userPrompt) {
  const messages = [...chatHistory, { role: 'user', content: userPrompt }];
  const functions = [
    {
      name: 'search_products_in_HM',
      description: 'search products in the HM website example: looking for Tshirts, or any type of dress',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The Dress or product that HM sales online, e.g., TShirt, iron-skjorta ',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'search_products_in_electronics',
      description: 'search products in the Electronics website example: looking for Camera, or any electronic device',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The Electronic or product that electronics online, e.g., Camera, mobile ',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'add_to_cart',
      description: 'add a product to the cart by calling a POST API',
      parameters: {
        type: 'object',
        properties: {
          productId: {
            type: 'string',
            description: 'The ID of the product to add to the cart',
          },
          quantity: {
            type: 'integer',
            description: 'The quantity of the product to be added to the cart',
          },
        },
        required: ['productId','quantity'],
      },
    },
    {
      name: 'get_cart',
      description: 'get Cart Details by a GET API Call',
      parameters: {
        type: 'object',
        properties: {
          cartUID: {
            type: 'string',
            description: 'The ID of the cart',
          },
        },
        required: ['cartUID'],
      },
    },
    {
      name: 'delete_cart_entry',
      description: 'Delete a cart entry by calling the SAP OCC v2 API.',
      parameters: {
        type: 'object',
        properties: {
          entryNumber: {
            type: 'integer',
            description: 'The number of the entry to be deleted.',
          },
        },
        required: ['entryNumber'],
      },
    },
    {
      name: 'update_cart_entry_quantity',
      description: 'update quantity of a cart entry by calling a PUT API',
      parameters: {
        type: 'object',
        properties: {
          entryNumber: {
            type: 'integer',
            description: 'The entry number of the cart entry to update',
          },
          newQuantity: {
            type: 'integer',
            description: 'The new quantity for the cart entry',
          },
        },
        required: ['entryNumber', 'newQuantity'],
      },
    },
    {
      name: 'get_applied_vouchers',
      description: 'get applied vouchers for a cart by calling a GET API',
      parameters: {
        type: 'object',
        properties: {
          baseSiteId: {
            type: 'string',
            description: 'The base site ID',
          },
          userId: {
            type: 'string',
            description: 'The user ID',
          },
          cartId: {
            type: 'string',
            description: 'The cart ID',
          },
        },
        required: ['baseSiteId', 'userId', 'cartId'],
      },
    },
    
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: messages,
    functions: functions,
    function_call: 'auto',
  });

  // Store the new chat history
  chatHistory.push(response.choices[0].message);


  return response.choices[0].message;
}
// ... (existing code)

app.post('/', async (req, res) => {
  try {
    let userPrompt;

    // Check if the request contains audio data
    if (req.body.audio) {
      // Convert speech to text
      const speechRecognitionResult = await convertSpeechToText(req.body.audio);
      userPrompt = speechRecognitionResult.results[0]?.alternatives[0]?.transcript || '';
    } else {
      // If no audio data, use the text prompt
      userPrompt = req.body.prompt;
    }

    const responseMessage = await runGPTConversation(userPrompt);

    if (responseMessage.function_call) {
      const functionName = responseMessage.function_call.name;
      const functionToCall = {
        search_products_in_electronics:searchProductsInElectronics,
        search_products_in_HM:searchProductsInHM,
        add_to_cart: addToCart,
        get_cart:getCart,
        delete_cart_entry: deleteCartEntry,
        update_cart_entry_quantity:updateCartEntryQuantity,
        get_applied_vouchers:getAppliedVouchers, 
      }[functionName];

      if (functionToCall) {
        const functionArgs = JSON.parse(responseMessage.function_call.arguments);
        console.log('functionArgs:', functionArgs);

        // Extract parameters based on the function name
        let functionResponse;
        if (functionName === 'delete_cart_entry') {
          const entryNumber = functionArgs.entryNumber;
          console.log('functionArgs for delete cart entry is :', entryNumber);
          functionResponse = await functionToCall(entryNumber);
        } else if (functionName === 'search_products_in_electronics') {
          functionResponse = await functionToCall(functionArgs.query);
        } else if (functionName === 'add_to_cart') {
          functionResponse = await functionToCall(functionArgs.productId ,functionArgs.quantity );
        } else if (functionName === 'get_cart') {
          functionResponse = await functionToCall( );
        }else if (functionName === 'search_products_in_HM') {
          functionResponse = await functionToCall(functionArgs.query);
        } else if (functionName ==='update_cart_entry_quantity'){
          functionResponse = await functionToCall(functionArgs.entryNumber ,functionArgs.newQuantity );
        }else if (functionName ==='get_applied_vouchers'){
          functionResponse = await functionToCall(functionArgs.baseSiteId ,functionArgs.userId ,functionArgs.cartId);
        }

        console.log('Function response:', functionResponse);
        const messages = [
          responseMessage,
          {
            role: 'function',
            name: functionName,
            content: JSON.stringify(functionResponse),
          },
        ];

        const secondResponse = await openai.chat.completions.create({
          model: 'gpt-4',
          messages,
        });

        chatHistory.push(secondResponse.choices[0].message);

        res.status(200).send({
          bot: secondResponse.choices[0].message.content,
        });
      } else {
        console.error('Function not found:', functionName);
        res.status(500).json({ error: 'Function not found' });
      }
    } else {
      // Handling non-function calls
      // If you have additional logic or messages to add for non-function calls, you can do it here
      const messages = [
        responseMessage,
        // Optionally, add more messages or logic here based on your requirements
      ];

      const secondResponse = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages,
      });

      chatHistory.push(secondResponse.choices[0].message);

      res.status(200).send({
        bot: secondResponse.choices[0].message.content,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});




app.listen(5000, () => console.log('AI server started on http://localhost:5000'));