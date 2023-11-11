import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import OpenAI from "openai";
import axios from 'axios';
import https from 'https'
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
console.log('Environment variables:', process.env);
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

    const response = await axios.post(url, data);

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


async function searchProductsInHM(query) {
  try {

    const url = `https://wc071439b.api.esales.apptus.cloud/api/v2/panels/slp?esales.sessionKey=af8716a7-b9af-4cbe-b94a-7a7576c0915b&esales.customerKey=af8716a7-b9af-4cbe-b94a-7a7576c0915b&esales.market=SE&market_locale=sv_se&search_prefix=${query}&search_phrase=${query}`;

    const response = await axios.get(url);

    if (response.status === 200) {
      if (typeof response.data !== 'undefined') {
       const attributesToExclude = ['all_categories_codes', 'category_path','folder_rankings','v_available_size_options','nonProductSuggestions','autocomplete','v_gallery_images','v_size_filters','attributes','topSearches','didYouMean','v_available_size_codes','v_available_size_rate','v_categories_names','v_color_code','v_color_filter','v_fashion_image'];
       const modifiedJson = excludeAttributes(response.data, attributesToExclude);
       console.error(' modifiedJson response from Aptus Search Engine :'+JSON.stringify(modifiedJson));
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
        },
        required: ['productId'],
      },
    },
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
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
    const userPrompt = req.body.prompt;
    const responseMessage = await runGPTConversation(userPrompt);

    if (responseMessage.function_call) {
      const functionName = responseMessage.function_call.name;
      const functionToCall = {
        search_products_in_electronics:searchProductsInElectronics,
        search_products_in_HM:searchProductsInElectronics,
        add_to_cart: addToCart,
      }[functionName];

      if (functionToCall) {
        const functionArgs = JSON.parse(responseMessage.function_call.arguments);
        const functionResponse = await functionToCall(functionArgs.query || functionArgs.productId,functionArgs.quantity);

        const messages = [
          responseMessage,
          {
            role: 'function',
            name: functionName,
            content: JSON.stringify(functionResponse),
          },
        ];

        const secondResponse = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
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